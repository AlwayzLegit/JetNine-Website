import { NextResponse, type NextRequest } from "next/server";
import { SCREEN_ANSWER_PATH } from "@/lib/voice-agent";
import { readTwilioWebhook } from "@/lib/twilio-webhook";
import { phoneWords } from "@/lib/voice-routing";
import { emptyTwiml, screenTwiml } from "@/lib/voice-twiml";

// Press 1 to accept: the <Number url> of the ring-first <Dial>. Runs on the
// leg of whoever picked up, while the caller keeps hearing ringing. Their
// answer goes to ./answer; no answer (a voicemail) hangs up that leg, and
// /api/voice/connect sees DialBridged=false and hands the call to the agent.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "content-type": "text/xml; charset=utf-8" } });
}

/** "+18185550123" → "8 1 8, 5 5 5, 0 1 2 3", so the number is read digit by digit. */
function spoken(e164: string | undefined): string {
  if (!e164) return "an unknown number";
  const words = phoneWords(e164);
  const m = /^\((\d{3})\) (\d{3})-(\d{4})$/.exec(words);
  if (!m) return /^\+\d+$/.test(e164) ? e164.slice(1).split("").join(" ") : "an unknown number";
  return m.slice(1).map((g) => g.split("").join(" ")).join(", ");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const read = await readTwilioWebhook(request, "voice:screen");
  if (!read.ok) return xml(emptyTwiml(), 403);
  // On the dialled leg, From is the caller ID we passed through: the caller.
  return xml(screenTwiml({ from: spoken(read.params.From), action: SCREEN_ANSWER_PATH }));
}
