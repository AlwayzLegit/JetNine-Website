import twilio from "twilio";
import { config, urls } from "./config.js";
import type { TranscriptTurn } from "./db/queries.js";

// Warm transfer + SMS alerting. The transfer itself is driven by TwiML:
// the relay session ends with handoffData, Twilio requests the <Connect
// action> URL, and server.ts answers with <Dial> to the broker. This file
// holds the REST-side pieces: recording start and the alert SMS.

let twilioClient: ReturnType<typeof twilio> | null = null;
export function getTwilio() {
  if (!twilioClient) {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      throw new Error("Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
    }
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

export async function startRecording(callSid: string): Promise<void> {
  if (!config.voice.recordingEnabled) return;
  await getTwilio().calls(callSid).recordings.create({
    recordingChannels: "dual",
    recordingStatusCallback: urls.https("/recording-status"),
    recordingStatusCallbackEvent: ["completed"],
  });
}

export function leadSummarySms(input: {
  from: string;
  summary?: string | null;
  transcript: TranscriptTurn[];
  escalated: boolean;
  escalationReason?: string | null;
  brokerAnswered?: boolean;
}): string {
  const head = input.escalated
    ? `JetNine HOT CALL${input.brokerAnswered === false ? " (broker missed)" : ""}`
    : "JetNine lead";
  const firstUser = input.transcript.find((t) => t.role === "user")?.text ?? "";
  const body = input.summary || firstUser.slice(0, 200) || "No summary";
  const reason = input.escalationReason ? ` · ${input.escalationReason.replace(/_/g, " ")}` : "";
  return `${head}${reason}\nFrom ${input.from}\n${body}`.slice(0, 1500);
}

/** Behind SMS_ALERTS_ENABLED: a fresh number needs A2P/toll-free registration before SMS delivers reliably. */
export async function sendAlertSms(body: string, log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void }) {
  if (!config.escalation.smsAlertsEnabled) {
    log.info({ body }, "SMS alert suppressed (SMS_ALERTS_ENABLED=false)");
    return;
  }
  if (!config.escalation.alertPhone) {
    log.warn({}, "SMS alert skipped: ALERT_PHONE unset");
    return;
  }
  try {
    await getTwilio().messages.create({ to: config.escalation.alertPhone, from: config.twilio.number, body });
    log.info({ to: config.escalation.alertPhone }, "SMS alert sent");
  } catch (err) {
    // Most likely cause on a new number: A2P/toll-free registration pending.
    log.warn({ err: err instanceof Error ? err.message : err }, "SMS alert FAILED — check A2P/toll-free registration");
  }
}
