import "server-only";
import { holdTwiml, redirectTwiml, voicemailTwiml } from "@/lib/voice-twiml";

/**
 * The voice agent (voice/ on Render) as seen from the site.
 *
 * Render's free plan sleeps the service after about 15 idle minutes and
 * takes 30–60 seconds to wake, longer than Twilio waits for a webhook. So
 * the site answers Twilio itself, wakes the agent the moment a call
 * arrives (it boots while a person's phone rings), and only redirects the
 * call once the agent says it is ready. Until then the caller holds; if
 * the agent never comes up, they leave a message.
 */

export const VOICE_AGENT_URL = (process.env.VOICE_AGENT_URL || "https://jetnine-voice.onrender.com").replace(/\/+$/, "");

/** How many holds (about 7 seconds each) before the caller is sent to voicemail. */
export const MAX_HOLDS = 6;

export type AgentStatus = "ready" | "waking" | "down";

/**
 * Ask the agent's /health. 200 → ready. Its own 503 (it is up but not
 * configured; waiting will not help) → down. No answer in time, or an
 * error page from Render's edge while it boots → waking.
 */
export async function agentStatus(timeoutMs = 4000): Promise<AgentStatus> {
  try {
    const res = await fetch(`${VOICE_AGENT_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      await res.body?.cancel().catch(() => {});
      return "ready";
    }
    const body = await res.text().catch(() => "");
    return body.includes('"jetnine-voice"') ? "down" : "waking";
  } catch {
    return "waking";
  }
}

/** Fire-and-forget: one request is enough to start a sleeping service. */
export async function wakeAgent(): Promise<void> {
  try {
    const res = await fetch(`${VOICE_AGENT_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    await res.body?.cancel().catch(() => {});
  } catch {
    // Timed out while booting, or unreachable: the call path checks again.
  }
}

export function agentTwimlUrl(missed: boolean): string {
  return `${VOICE_AGENT_URL}/twiml${missed ? "?missed=1" : ""}`;
}

export function connectPath(args: { missed: boolean; attempt?: number }): string {
  const q = new URLSearchParams();
  if (args.missed) q.set("missed", "1");
  if (args.attempt) q.set("attempt", String(args.attempt));
  const s = q.toString();
  return `/api/voice/connect${s ? `?${s}` : ""}`;
}

export const VOICEMAIL_PATH = "/api/voice/voicemail";

/** The agent if it is ready, a hold while it wakes, or voicemail. */
export async function toAgent(args: { missed: boolean; attempt: number; callSid?: string }): Promise<string> {
  const status = await agentStatus();
  if (status === "ready") return redirectTwiml(agentTwimlUrl(args.missed));
  if (status === "waking" && args.attempt < MAX_HOLDS) {
    return holdTwiml({ next: connectPath({ missed: args.missed, attempt: args.attempt + 1 }), attempt: args.attempt });
  }
  console.warn("[voice] agent unavailable, taking a message", { status, attempt: args.attempt, callSid: args.callSid });
  return voicemailTwiml(VOICEMAIL_PATH);
}
