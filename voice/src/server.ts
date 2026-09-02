import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import formbody from "@fastify/formbody";
import websocket from "@fastify/websocket";
import twilio from "twilio";
import { config, urls } from "./config.js";
import { CallSession } from "./relay/session.js";
import type { HandoffData } from "./relay/messages.js";
import { escalationDialTwiml, escalationFallbackTwiml, hangupTwiml, relayTwiml } from "./twiml.js";
import { getCallBySid, setRecording, updateCall } from "./db/queries.js";
import { leadSummarySms, sendAlertSms } from "./escalation.js";

// HTTP: Twilio webhooks (TwiML). WS: ConversationRelay sessions.
//
//   POST /twiml               inbound call → <Connect><ConversationRelay>
//   WS   /relay               the conversation
//   POST /relay/action        relay session ended → <Dial> broker or <Hangup>
//   POST /escalation/result   after <Dial>: fallback if the broker missed it
//   POST /recording-status    Twilio recording callback
//   GET  /health

const app = Fastify({
  logger: { level: config.env === "production" ? "info" : "debug" },
});
await app.register(formbody);
await app.register(websocket);

type TwilioBody = Record<string, string>;

/** Reject webhooks that Twilio did not sign (production only by default). */
function assertTwilioSignature(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!config.twilio.validateSignatures) return true;
  const signature = req.headers["x-twilio-signature"];
  const url = urls.https(req.url);
  const ok =
    typeof signature === "string" &&
    twilio.validateRequest(config.twilio.authToken, signature, url, (req.body as TwilioBody) ?? {});
  if (!ok) {
    req.log.warn({ url }, "twilio: bad signature");
    reply.code(403).send("forbidden");
  }
  return ok;
}

const xml = (reply: FastifyReply, body: string) => reply.type("text/xml").send(body);

app.get("/health", async () => ({ ok: true, service: "jetnine-voice", model: config.anthropic.model }));

app.post("/twiml", async (req, reply) => {
  if (!assertTwilioSignature(req, reply)) return;
  const body = req.body as TwilioBody;
  req.log.info({ callSid: body.CallSid, from: body.From }, "twiml: inbound call");
  return xml(reply, relayTwiml());
});

// ConversationRelay ended (we sent `end`, or the caller hung up). Twilio
// posts HandoffData when we set it; decide what the call does next.
app.post("/relay/action", async (req, reply) => {
  if (!assertTwilioSignature(req, reply)) return;
  const body = req.body as TwilioBody;
  let handoff: HandoffData | null = null;
  if (body.HandoffData) {
    try {
      handoff = JSON.parse(body.HandoffData) as HandoffData;
    } catch {
      req.log.warn({ raw: body.HandoffData }, "relay/action: bad HandoffData");
    }
  }
  req.log.info({ callSid: body.CallSid, action: handoff?.action, status: body.SessionStatus }, "relay/action");
  if (handoff?.action === "escalate") {
    return xml(reply, escalationDialTwiml(body.CallSid));
  }
  return xml(reply, hangupTwiml());
});

// <Dial> finished. Anything but "completed" means the broker did not pick up:
// the lead is already saved; alert the desk and reassure the caller.
app.post("/escalation/result", async (req, reply) => {
  if (!assertTwilioSignature(req, reply)) return;
  const body = req.body as TwilioBody;
  const callSid = (req.query as { callSid?: string }).callSid ?? body.CallSid;
  const answered = body.DialCallStatus === "completed";
  req.log.info({ callSid, dialStatus: body.DialCallStatus }, "escalation: dial result");
  if (answered) return xml(reply, hangupTwiml());

  try {
    const call = await getCallBySid(callSid);
    if (call) {
      await updateCall(call.id, { escalation_reason: `${call.outcome === "escalated" ? "" : ""}broker_unanswered` });
      await sendAlertSms(
        leadSummarySms({
          from: call.from_number ?? "",
          summary: call.summary,
          transcript: (call.transcript as never[]) ?? [],
          escalated: true,
          escalationReason: "broker unanswered — call back now",
          brokerAnswered: false,
        }),
        req.log,
      );
    }
  } catch (err) {
    req.log.error({ err }, "escalation: fallback bookkeeping failed");
  }
  return xml(reply, escalationFallbackTwiml());
});

app.post("/recording-status", async (req, reply) => {
  if (!assertTwilioSignature(req, reply)) return;
  const body = req.body as TwilioBody;
  if (body.RecordingStatus === "completed" && body.CallSid && body.RecordingSid) {
    try {
      await setRecording(body.CallSid, body.RecordingSid, body.RecordingUrl ?? "");
    } catch (err) {
      req.log.error({ err }, "recording-status: save failed");
    }
  }
  return reply.code(204).send();
});

app.get("/relay", { websocket: true }, (socket, req) => {
  const session = new CallSession(socket, req.log);
  socket.on("message", (data) => {
    void session.handle(data.toString());
  });
  socket.on("close", () => {
    void session.onClose();
  });
  socket.on("error", (err) => req.log.error({ err }, "relay: socket error"));
});

app.listen({ port: config.port, host: "0.0.0.0" }).then(() => {
  app.log.info({ wss: urls.wss, model: config.anthropic.model, tts: config.voice.ttsVoice || "(catalog default)" }, "jetnine-voice listening");
});
