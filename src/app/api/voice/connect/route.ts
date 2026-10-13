import { NextResponse, type NextRequest } from "next/server";
import { toAgent } from "@/lib/voice-agent";
import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { emptyTwiml, hangupTwiml } from "@/lib/voice-twiml";

// Where a call goes after the team's phones rang (the <Dial> action) and
// each time a caller holds while the agent wakes (a <Redirect>).
//   ?missed=1   the team did not answer: the agent greets accordingly
//   ?attempt=n  holds so far (src/lib/voice-agent.ts MAX_HOLDS)

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "content-type": "text/xml; charset=utf-8" } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const read = await readTwilioWebhook(request, "voice:connect");
  if (!read.ok) return xml(emptyTwiml(), 403);
  const p = read.params;

  // Someone on the team answered and the call has ended, or the caller
  // hung up while it rang: nothing left to do.
  if (p.DialCallStatus === "completed" || p.DialCallStatus === "canceled" || p.CallStatus === "completed") {
    console.log("[voice:connect] done", { callSid: p.CallSid, dial: p.DialCallStatus, call: p.CallStatus });
    return xml(hangupTwiml());
  }

  const missed = read.url.searchParams.get("missed") === "1";
  const attemptN = Number(read.url.searchParams.get("attempt") ?? 0);
  const attempt = Number.isInteger(attemptN) && attemptN >= 0 ? attemptN : 0;
  if (p.DialCallStatus) {
    console.log("[voice:connect] team missed the call", { callSid: p.CallSid, dial: p.DialCallStatus });
  }
  return xml(await toAgent({ missed, attempt, callSid: p.CallSid }));
}
