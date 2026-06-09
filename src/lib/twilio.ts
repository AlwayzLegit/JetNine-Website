import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio outbound + inbound helpers. Ships dark when
 * TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN aren't set — `sendSms` falls
 * through to the logger path, same shape as `sendEmail`.
 *
 * Why no SDK: Twilio's REST API is a single form-encoded POST per send.
 * The official SDK adds ~150kB to the runtime; raw fetch is identical
 * functionally and provider-swap stays trivial.
 *
 * Outbound caller is responsible for E.164 normalization. Bodies are
 * truncated to 1500 chars (well within the SMS 1600 hard limit, leaves
 * room for any header text the carrier may inject).
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SMS_FROM = process.env.TWILIO_SMS_FROM; // E.164, e.g. +18885551234
// WhatsApp sender — Twilio uses the `whatsapp:+E164` prefix on both
// `To` and `From`. Sandbox value during dev: whatsapp:+14155238886.
// Prod requires a WhatsApp Business Account (WABA) registration.
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

const HAS_TWILIO = Boolean(ACCOUNT_SID && AUTH_TOKEN && SMS_FROM);
const HAS_WHATSAPP = Boolean(ACCOUNT_SID && AUTH_TOKEN && WHATSAPP_FROM);

export function isTwilioConfigured(): boolean {
  return HAS_TWILIO;
}

export function isWhatsAppConfigured(): boolean {
  return HAS_WHATSAPP;
}

// Same shape as email's SendResult so callers can stamp delivery
// status without branching: `provider` + `messageId` both populated
// (messageId mapped from Twilio's `sid`).
export type TwilioSendResult =
  | { ok: true; provider: "twilio" | "logger"; messageId?: string }
  | { ok: false; error: string };

export type SmsPayload = {
  to: string; // E.164
  body: string;
};

/**
 * Send an SMS via Twilio. Logger fallback when the env isn't set —
 * useful for local dev without a Twilio account.
 */
export async function sendSms(payload: SmsPayload): Promise<TwilioSendResult> {
  const body = payload.body.slice(0, 1500);

  if (!HAS_TWILIO) {
    console.log("[twilio:sms:dry-run]", {
      to: payload.to,
      bodyPreview: body.slice(0, 100),
    });
    return { ok: true, provider: "logger" };
  }

  // Twilio's REST API: form-urlencoded POST with basic auth.
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
  const formData = new URLSearchParams();
  formData.set("To", payload.to);
  formData.set("From", SMS_FROM!);
  formData.set("Body", body);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: formData.toString(),
    });
  } catch (err) {
    return { ok: false, error: `twilio fetch failed: ${String(err)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `twilio ${res.status}: ${text.slice(0, 200)}` };
  }

  const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string };
  return { ok: true, provider: "twilio", messageId: json.sid };
}

/**
 * Verify an inbound Twilio webhook signature. Returns true if the
 * X-Twilio-Signature header matches the expected HMAC-SHA1 over the
 * (request URL + sorted form params concatenated) using the auth
 * token as the key.
 *
 * Doc: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Caller must pass the *original* URL Twilio called (proto + host +
 * path + query). We can't reconstruct from `request.url` alone if the
 * deployment sits behind a proxy that mangles the host header — but
 * Vercel preserves `x-forwarded-host` + `x-forwarded-proto` so the
 * route handler that calls this builds the URL correctly.
 */
export function verifyTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string | null,
): boolean {
  if (!AUTH_TOKEN || !signatureHeader) return false;

  // Per Twilio's algorithm: sort params by key, then for each key
  // concatenate `${key}${value}` (no separator). Append to URL.
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const k of sortedKeys) {
    data += k + params[k];
  }

  const expected = createHmac("sha1", AUTH_TOKEN).update(data).digest("base64");
  // Constant-time compare. Both inputs are base64; lengths match by
  // construction (HMAC-SHA1 is 20 bytes = 28 base64 chars), but guard
  // anyway since Twilio could change the algorithm.
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

// ─── Domain senders ───────────────────────────────────────────────────────
// Thin wrappers that the message-thread + trip-status actions call.
// Same SendResult-like shape as email so callers can update
// messages.delivery_status with the same code path.

export async function sendThreadMessageSms(args: {
  to: string;
  subjectCode: string;
  body: string;
}): Promise<TwilioSendResult> {
  // SMS doesn't have a subject; prepend the entity code so the
  // customer's reply lands in (and our heuristic matches it to) the
  // right thread.
  const text = `[${args.subjectCode}] ${args.body}`;
  return sendSms({ to: args.to, body: text });
}

/**
 * Send a WhatsApp message via Twilio. Same REST endpoint as SMS, but
 * `To` and `From` use the `whatsapp:+E164` scheme. Caller passes a
 * plain E.164 number; we apply the prefix.
 *
 * Production WhatsApp requires a Twilio WhatsApp Business Account
 * (WABA) sender + an opt-in conversation from the recipient (or an
 * approved templated outbound). For dev, Twilio's sandbox sender
 * (whatsapp:+14155238886) works once the recipient joins the sandbox
 * via the "join <code>" SMS.
 */
export async function sendWhatsApp(payload: SmsPayload): Promise<TwilioSendResult> {
  const body = payload.body.slice(0, 4000);

  if (!HAS_WHATSAPP) {
    console.log("[twilio:whatsapp:dry-run]", {
      to: payload.to,
      bodyPreview: body.slice(0, 100),
    });
    return { ok: true, provider: "logger" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
  const formData = new URLSearchParams();
  formData.set("To", `whatsapp:${payload.to}`);
  formData.set("From", WHATSAPP_FROM!);
  formData.set("Body", body);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: formData.toString(),
    });
  } catch (err) {
    return { ok: false, error: `twilio whatsapp fetch failed: ${String(err)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `twilio whatsapp ${res.status}: ${text.slice(0, 200)}` };
  }

  const json = (await res.json().catch(() => ({}))) as { sid?: string };
  return { ok: true, provider: "twilio", messageId: json.sid };
}

export async function sendThreadMessageWhatsApp(args: {
  to: string;
  subjectCode: string;
  body: string;
}): Promise<TwilioSendResult> {
  const text = `[${args.subjectCode}] ${args.body}`;
  return sendWhatsApp({ to: args.to, body: text });
}

const STATUS_SMS_HEADLINES: Record<string, string> = {
  confirmed: "JetNine: your trip is locked in.",
  boarding: "JetNine: the aircraft is ready when you are.",
  completed: "JetNine: wheels down. Hope it flew well.",
  cancelled_wx: "JetNine: weather got in the way — we've stood this down.",
  cancelled_other: "JetNine: this trip has been cancelled.",
  diverted: "JetNine: we're diverting; dispatch will call you in minutes.",
  irregular_ops: "JetNine: operational issue — a dispatcher is calling you now.",
};

export async function sendTripStatusSms(args: {
  to: string;
  tripCode: string;
  status: string;
  firstLeg?: string | null;
}): Promise<TwilioSendResult> {
  const headline = STATUS_SMS_HEADLINES[args.status] ?? `JetNine: trip update.`;
  const itinerary = args.firstLeg ? ` (${args.firstLeg})` : "";
  const body =
    `[${args.tripCode}] ${headline}${itinerary} ` +
    `Dispatch: +1 (818) 900-5278 · 24/7. Reply here to reach us.`;
  return sendSms({ to: args.to, body });
}
