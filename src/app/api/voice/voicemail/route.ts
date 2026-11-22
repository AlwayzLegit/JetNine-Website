import { NextResponse, type NextRequest } from "next/server";
import { voiceRouting } from "@/domain/settings/queries";
import { sendDispatchAlert, type SendResult } from "@/lib/email";
import { recipientsFor } from "@/lib/desk-settings";
import { auditDeskAlert } from "@/lib/desk-alert-audit";
import { DESK_ALERT_KIND } from "@/lib/desk-alert-recipients.mjs";
import { sendSms } from "@/lib/twilio";
import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { phoneWords } from "@/lib/voice-routing";
import { emptyTwiml, hangupTwiml, voicemailThanksTwiml } from "@/lib/voice-twiml";

// The <Record> action: a caller left a message because neither the team
// nor the agent could take the call. Text it to the numbers in Settings ›
// Voice agent › Routing and email the dispatch inbox.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "content-type": "text/xml; charset=utf-8" } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const read = await readTwilioWebhook(request, "voice:voicemail");
  if (!read.ok) return xml(emptyTwiml(), 403);
  const p = read.params;

  const seconds = Number(p.RecordingDuration ?? 0);
  if (!p.RecordingUrl || !(seconds > 0)) {
    console.log("[voice:voicemail] no message", { callSid: p.CallSid });
    return xml(hangupTwiml());
  }

  const from = p.From ? phoneWords(p.From) : "an unknown number";
  const length = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
  const listen = `${p.RecordingUrl}.mp3`;
  console.log("[voice:voicemail] message", { callSid: p.CallSid, seconds });

  const routing = await voiceRouting();
  // Read before the allSettled: recipientsFor never throws, and a [] answer
  // leaves the alert on the shared inbox alone.
  const staff = await recipientsFor(DESK_ALERT_KIND);
  const results = await Promise.allSettled([
    ...routing.numbers.map((to) =>
      sendSms({ to, body: `JetNine voicemail from ${from} (${length}). Listen: ${listen}` }),
    ),
    sendDispatchAlert({
      subject: `Voicemail from ${from}`,
      headline: "A caller left a voicemail",
      lines: [
        `From: ${from}`,
        `Length: ${length}`,
        "Nobody on the team and not the voice agent could take this call. Call them back.",
      ],
      link: { label: "Listen", url: listen },
      to: staff,
    }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[voice:voicemail] alert failed", r.reason);
  }

  // OPS-279: record whether the desk alert went out. The email alert is the last result; the
  // texts come first. Counts and the call sid only: no phone number.
  const texts = results.slice(0, routing.numbers.length);
  const smsSent = texts.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
  const emailAlert = results[results.length - 1] as PromiseSettledResult<SendResult>;
  await auditDeskAlert({
    action: "voicemail.notify.email",
    subjectType: "system",
    result: emailAlert,
    staffRecipients: staff.length,
    extra: { callSid: p.CallSid ?? null, smsSent, smsFailed: texts.length - smsSent },
  });

  return xml(voicemailThanksTwiml());
}
