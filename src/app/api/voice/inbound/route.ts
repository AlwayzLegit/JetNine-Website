import { NextResponse, after, type NextRequest } from "next/server";
import { voiceRouting } from "@/domain/settings/queries";
import { connectPath, toAgent, wakeAgent } from "@/lib/voice-agent";
import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { ringFirstApplies } from "@/lib/voice-routing";
import { emptyTwiml, ringFirstTwiml } from "@/lib/voice-twiml";

// Twilio "A call comes in" for the JetNine line. Settings › Voice agent ›
// Routing decides: ring the team first and hand a missed call to the
// agent, or hand every call to the agent. Either way the agent is woken
// now, so it has booted by the time it is needed (src/lib/voice-agent.ts).
//
// A 403 here (bad signature) or any 5xx makes Twilio fetch the number's
// Fallback URL, which forwards the call to a mobile: a caller is never
// left with an error message.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "content-type": "text/xml; charset=utf-8" } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const read = await readTwilioWebhook(request, "voice:inbound");
  if (!read.ok) return xml(emptyTwiml(), 403);

  after(wakeAgent);

  const routing = await voiceRouting();
  console.log("[voice:inbound] call", {
    callSid: read.params.CallSid,
    ringFirst: ringFirstApplies(routing),
    rings: routing.rings,
  });
  if (ringFirstApplies(routing)) {
    return xml(
      ringFirstTwiml({ numbers: routing.numbers, rings: routing.rings, action: connectPath({ missed: true }) }),
    );
  }
  return xml(await toAgent({ missed: false, attempt: 0, callSid: read.params.CallSid }));
}
