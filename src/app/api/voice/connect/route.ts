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

  // The caller hung up (while it rang, or after talking to the team), or
  // someone on the team took the call and it has ended: nothing left to do.
  // With press 1 to accept, a leg that answered but never pressed 1 (a
  // phone's own voicemail) also reports "completed", with DialBridged=false:
  // that call was missed and goes on to the agent.
  const bridged = p.DialBridged === undefined ? p.DialCallStatus === "completed" : p.DialBridged === "true";
  if (p.CallStatus === "completed" || p.DialCallStatus === "canceled" || bridged) {
    console.log("[voice:connect] done", {
      callSid: p.CallSid,
      dial: p.DialCallStatus,
      bridged: p.DialBridged,
      call: p.CallStatus,
    });
    return xml(hangupTwiml());
  }

  const missed = read.url.searchParams.get("missed") === "1";
  const attemptN = Number(read.url.searchParams.get("attempt") ?? 0);
  const attempt = Number.isInteger(attemptN) && attemptN >= 0 ? attemptN : 0;
  if (p.DialCallStatus) {
    console.log("[voice:connect] team missed the call", {
      callSid: p.CallSid,
      dial: p.DialCallStatus,
      bridged: p.DialBridged,
    });
  }
  return xml(await toAgent({ missed, attempt, callSid: p.CallSid }));
}
