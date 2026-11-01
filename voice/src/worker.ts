import { config, isConfigured, missingEnv, urls } from "./config.js";
import { liveAgent } from "./agent-store.js";
import type { HandoffData } from "./relay/messages.js";
import {
  callbackReassuranceTwiml,
  escalationAcceptTwiml,
  escalationDialTwiml,
  escalationFallbackTwiml,
  escalationScreenTwiml,
  hangupTwiml,
  RELAY_FAILED_LINE,
  relayTwiml,
  unavailableTwiml,
} from "./twiml.js";
import { getCallBySid, setRecording, updateCall } from "./db/queries.js";
import { leadSummarySms, sendAlertSms } from "./escalation.js";
import { describeRouting, resolveRouting } from "./llm/providers.js";
import { validateTwilioRequest } from "./twilio.js";
import { log, type Logger } from "./log.js";

export { CallRelay } from "./call-relay.js";

// HTTP: Twilio webhooks (TwiML). WS: ConversationRelay sessions, each in
// its call's CallRelay Durable Object.
//
//   POST /twiml               inbound call → <Connect><ConversationRelay> (?missed=1: after ring-first)
//   WS   /relay[/<CallSid>]   the conversation (Durable Object named by CallSid)
//   POST /relay/action        relay session ended → <Dial> broker or <Hangup>
//   POST /escalation/screen   broker's leg: "press 1 to accept" (+ /answer)
//   POST /escalation/result   after <Dial>: fallback if the broker missed it
//   POST /recording-status    Twilio recording callback
//   GET  /health

type TwilioBody = Record<string, string>;
type Ctx = { req: Request; url: URL; body: TwilioBody; log: Logger; env: Env };

const xml = (body: string) => new Response(body, { headers: { "content-type": "text/xml; charset=utf-8" } });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Reject webhooks that Twilio did not sign (production only by default). */
async function twilioSigned(c: Ctx): Promise<boolean> {
  if (!config.twilio.validateSignatures) return true;
  const url = urls.https(c.url.pathname + c.url.search);
  const ok = await validateTwilioRequest(config.twilio.authToken, c.req.headers.get("x-twilio-signature"), url, c.body);
  if (!ok) c.log.warn({ url }, "twilio: bad signature");
  return ok;
}

/**
 * The ConversationRelay handshake. Twilio signs it over the socket URL with
 * no params, but which form it signs (wss:// or https://, trailing slash)
 * is unconfirmed, so all are tried, and a mismatch is only logged until
 * TWILIO_VALIDATE_RELAY_SIGNATURE=true (turn it on once a live call logs
 * "relay: handshake signature verified"). Returns false only to reject.
 */
async function relaySigned(req: Request, url: URL, callSid: string): Promise<boolean> {
  const signature = req.headers.get("x-twilio-signature");
  const path = url.pathname + url.search;
  const token = config.twilio.authToken;
  const signed =
    (await validateTwilioRequest(token, signature, `wss://${config.publicHost}${path}`, {}, { trailingSlash: true })) ||
    (await validateTwilioRequest(token, signature, urls.https(path), {}, { trailingSlash: true }));
  if (signed) {
    log.info({ callSid }, "relay: handshake signature verified");
    return true;
  }
  if (config.twilio.validateRelaySignature) {
    log.warn({ callSid, hasSignature: !!signature }, "relay: bad handshake signature");
    return false;
  }
  log.warn({ callSid, hasSignature: !!signature }, "relay: handshake signature did not verify (report-only)");
  return true;
}

/** Call-ready = every env var present AND an LLM provider resolvable (db route or env key). */
async function callReady(): Promise<{ ready: boolean; llm: ReturnType<typeof describeRouting> }> {
  const routing = await resolveRouting();
  return { ready: isConfigured() && routing.primary !== null, llm: describeRouting(routing) };
}

/** The call's Durable Object; it exists only while that call's relay socket is open. */
const callRelay = (env: Env, callSid: string) => env.CALL_RELAY.get(env.CALL_RELAY.idFromName(callSid));

async function health(): Promise<Response> {
  const { ready, llm } = await callReady();
  return json(ready ? 200 : 503, {
    ok: ready,
    service: "jetnine-voice",
    llm,
    tts: `${config.voice.ttsProvider}/${config.voice.ttsVoice || "default"}`,
    stt: `${config.voice.sttProvider}/${config.voice.sttModel}`,
    missingEnv,
  });
}

async function twiml({ url, body, log }: Ctx): Promise<Response> {
  const { ready, llm } = await callReady();
  if (!ready) {
    log.error({ missingEnv, llm }, "twiml: call received but service is not configured");
    return xml(unavailableTwiml());
  }
  // The site's ring-first routing (jetnine.com/api/voice/*) redirects here
  // with ?missed=1 once the team's phones have rung out.
  const missed = url.searchParams.get("missed") === "1";
  log.info({ callSid: body.CallSid, from: body.From, missed }, "twiml: inbound call");
  const agent = await liveAgent();
  log.info({ callSid: body.CallSid, agent: agent.name, version: agent.version }, "twiml: agent");
  return xml(relayTwiml({ missed, agent, callSid: body.CallSid }));
}

// ConversationRelay ended (we sent `end`, or the caller hung up). Twilio
// posts HandoffData when we set it; decide what the call does next.
async function relayAction({ url, body, log, env }: Ctx): Promise<Response> {
  let handoff: HandoffData | null = null;
  if (body.HandoffData) {
    try {
      handoff = JSON.parse(body.HandoffData) as HandoffData;
    } catch {
      log.warn({ raw: body.HandoffData }, "relay/action: bad HandoffData");
    }
  }
  log.info(
    {
      callSid: body.CallSid,
      action: handoff?.action,
      status: body.SessionStatus,
      callStatus: body.CallStatus,
      seconds: body.SessionDuration,
      errorCode: body.ErrorCode,
      error: body.ErrorMessage,
    },
    "relay/action",
  );
  const missed = url.searchParams.get("missed") === "1";
  if (handoff?.action === "escalate") {
    // A no-transfer call never goes back to the team (the session refuses
    // to escalate; this is the belt to that brace).
    if (missed) return xml(callbackReassuranceTwiml());
    return xml(escalationDialTwiml(body.CallSid, undefined, handoff.transferTo));
  }
  // The relay failed (Twilio, the speech providers or our socket) while the
  // caller is still on the line: never drop them.
  //   ring-first call (?missed=1, the team already passed on it): never
  //     back to the team. Reconnect the agent once, carrying the
  //     conversation; if that fails too, reassure, alert the desk, hang up.
  //   otherwise: save the call, then transfer to the broker with press 1 to
  //     accept; an unanswered transfer gets the callback reassurance and the
  //     "broker unanswered" SMS.
  if (body.SessionStatus === "failed" && body.CallStatus !== "completed") {
    const detail = [body.ErrorCode, body.ErrorMessage].filter(Boolean).join(" ") || "no error code";
    if (missed) {
      const reconnect = url.searchParams.get("reconnect") !== "1";
      log.error({ callSid: body.CallSid, errorCode: body.ErrorCode, error: body.ErrorMessage, reconnect }, "relay: session failed mid-call (no-transfer call)");
      try {
        const r = await callRelay(env, body.CallSid).relayFailed(body.CallSid, detail, { reconnecting: reconnect });
        if (!r.found && !reconnect) {
          const call = await getCallBySid(body.CallSid);
          if (call) await updateCall(call.id, { escalation_reason: "relay_failed", outcome: "escalated" });
        }
      } catch (err) {
        log.error({ err }, "relay: failed-session bookkeeping failed");
      }
      return xml(reconnect ? relayTwiml({ missed: true, reconnect: true, agent: await liveAgent(), callSid: body.CallSid }) : callbackReassuranceTwiml());
    }
    log.error({ callSid: body.CallSid, errorCode: body.ErrorCode, error: body.ErrorMessage }, "relay: session failed mid-call, transferring");
    let transferTo: string | undefined;
    try {
      const r = await callRelay(env, body.CallSid).relayFailed(body.CallSid, detail);
      if (r.found) {
        transferTo = r.transferNumber;
      } else {
        const call = await getCallBySid(body.CallSid);
        if (call) await updateCall(call.id, { escalation_reason: "relay_failed", outcome: "escalated" });
      }
    } catch (err) {
      log.error({ err }, "relay: failed-session bookkeeping failed");
    }
    return xml(escalationDialTwiml(body.CallSid, RELAY_FAILED_LINE, transferTo));
  }
  return xml(hangupTwiml());
}

// <Dial> finished. Anything but "completed" means the broker did not pick up:
// the lead is already saved; alert the desk and reassure the caller.
async function escalationResult({ url, body, log }: Ctx): Promise<Response> {
  const callSid = url.searchParams.get("callSid") ?? body.CallSid;
  // With press 1 to accept, a leg that picked up but never pressed 1 (the
  // broker's voicemail, a wrong key, a hang-up) also reports "completed",
  // with DialBridged=false: that transfer was not answered.
  const answered =
    body.DialBridged === undefined ? body.DialCallStatus === "completed" : body.DialBridged === "true";
  log.info({ callSid, dialStatus: body.DialCallStatus, bridged: body.DialBridged }, "escalation: dial result");
  if (answered) return xml(hangupTwiml());

  try {
    const call = await getCallBySid(callSid);
    if (call) {
      await updateCall(call.id, { escalation_reason: "broker_unanswered" });
      await sendAlertSms(
        leadSummarySms({
          from: call.from_number ?? "",
          summary: call.summary,
          transcript: (call.transcript as never[]) ?? [],
          escalated: true,
          escalationReason: "broker unanswered — call back now",
          brokerAnswered: false,
        }),
        log,
      );
    }
  } catch (err) {
    log.error({ err }, "escalation: fallback bookkeeping failed");
  }
  return xml(escalationFallbackTwiml());
}

async function screenAnswer({ body, log }: Ctx): Promise<Response> {
  const accepted = body.Digits === "1";
  log.info({ callSid: body.CallSid, accepted }, "escalation: screen answer");
  return xml(accepted ? escalationAcceptTwiml() : hangupTwiml());
}

async function recordingStatus({ body, log }: Ctx): Promise<Response> {
  if (body.RecordingStatus === "completed" && body.CallSid && body.RecordingSid) {
    try {
      await setRecording(body.CallSid, body.RecordingSid, body.RecordingUrl ?? "");
    } catch (err) {
      log.error({ err }, "recording-status: save failed");
    }
  }
  return new Response(null, { status: 204 });
}

/** Twilio webhooks: signed form POSTs answered with TwiML. */
const webhooks: Record<string, (c: Ctx) => Promise<Response>> = {
  "/twiml": twiml,
  "/relay/action": relayAction,
  "/escalation/result": escalationResult,
  "/escalation/screen": async () => xml(escalationScreenTwiml()),
  "/escalation/screen/answer": screenAnswer,
  "/recording-status": recordingStatus,
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "GET" && path === "/health") return health();

    // ConversationRelay: /relay/<CallSid> (TwiML from this Worker) or bare
    // /relay (an older TwiML document). A bare socket gets its own object;
    // it works, but /relay/action cannot find it by CallSid.
    if (path === "/relay" || path.startsWith("/relay/")) {
      if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        const callSid = path.startsWith("/relay/") ? decodeURIComponent(path.slice("/relay/".length)) : "";
        if (!(await relaySigned(req, url, callSid))) return new Response("forbidden", { status: 403 });
        const id = /^CA[0-9a-f]{32}$/i.test(callSid) ? env.CALL_RELAY.idFromName(callSid) : env.CALL_RELAY.newUniqueId();
        return env.CALL_RELAY.get(id).fetch(req);
      }
    }

    const handler = webhooks[path];
    if (!handler) return new Response("not found", { status: 404 });
    if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: { allow: "POST" } });

    const type = req.headers.get("content-type") ?? "";
    const body: TwilioBody = type.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries([...(await req.formData())].filter((e): e is [string, string] => typeof e[1] === "string"))
      : {};
    const c: Ctx = { req, url, body, log: log.child({ route: path }), env };
    if (!(await twilioSigned(c))) return new Response("forbidden", { status: 403 });
    try {
      return await handler(c);
    } catch (err) {
      c.log.error({ err }, "webhook: unhandled error");
      // Never leave a caller in silence.
      return path === "/recording-status" ? new Response(null, { status: 500 }) : xml(unavailableTwiml());
    }
  },
} satisfies ExportedHandler<Env>;
