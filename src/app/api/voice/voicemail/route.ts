import { NextResponse, type NextRequest } from "next/server";
import { voiceRouting } from "@/domain/settings/queries";
import { sendDispatchAlert } from "@/lib/email";
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
    }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[voice:voicemail] alert failed", r.reason);
  }

  return xml(voicemailThanksTwiml());
}
