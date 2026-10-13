import { NextResponse, type NextRequest } from "next/server";
import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { emptyTwiml, hangupTwiml, screenAcceptTwiml } from "@/lib/voice-twiml";

// The press-1 <Gather> action. 1 → connect the call. Anything else → end
// this leg; the caller goes on to the agent (/api/voice/connect).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "content-type": "text/xml; charset=utf-8" } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const read = await readTwilioWebhook(request, "voice:screen");
  if (!read.ok) return xml(emptyTwiml(), 403);
  const accepted = read.params.Digits === "1";
  console.log("[voice:screen] answer", { callSid: read.params.CallSid, accepted });
  return xml(accepted ? screenAcceptTwiml() : hangupTwiml());
}
