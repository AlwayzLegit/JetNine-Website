import { NextResponse } from "next/server";
import { d1Db } from "@/db/d1";
import { clientIpFrom } from "@/lib/client-ip";
import { addCounts } from "@/lib/chat/stats";
import { crewAiChat, crewAiStatus } from "@/lib/chat/crew-ai";
import { handleChat } from "@/lib/chat/handle";
import { CHAT_COOKIE, SESSION_SECONDS, cookieFromHeader, issueSession, verifySession } from "@/lib/chat/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { passesTurnstile, turnstileEnabled } from "@/lib/turnstile";

// The site chat (OPS-242). GET answers only whether the panel should be offered.
// POST takes the visitor's messages and answers { text, quote? } or { fallback: true }.
// The model call goes through the service binding to crew-ai; this route holds no
// key. No transcript is stored: only five daily counters (src/lib/chat/stats.ts).
// See docs/chat.md.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "cache-control": "no-store", "x-robots-tag": "noindex" };
const MAX_BODY = 20_000;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: HEADERS });
}

async function count(counts: Parameters<typeof addCounts>[1]): Promise<void> {
  try {
    const db = d1Db();
    if (db) await addCounts(db, counts);
  } catch (err) {
    console.error("[chat] counter write failed", { name: err instanceof Error ? err.name : "unknown" });
  }
}

/** With Turnstile on, the chat needs a secret to sign its session cookie: without one it stays off. */
function signingSecret(): string | null {
  return process.env.CRON_SECRET || null;
}

export async function GET(): Promise<NextResponse> {
  const s = await crewAiStatus();
  const sessionOk = !turnstileEnabled() || signingSecret() !== null;
  return json({ enabled: Boolean(s?.enabled) && sessionOk });
}

export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "invalid" }, 400);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid" }, 400);
  }

  const ip = clientIpFrom(req.headers) ?? "unknown";
  const limit = await checkRateLimit(`chat:${ip}`, { max: 30, windowSeconds: 3600 });
  if (!limit.ok) return json({ fallback: true, reason: "rate" }, 429);

  // The visitor pressed "Continue to your quote": one more hand-off in the day's count.
  if ((body as { event?: unknown } | null)?.event === "handoff") {
    await count({ handoffs: 1 });
    return json({ ok: true });
  }

  // Turnstile once per chat session: the first message carries a token, a signed cookie covers the rest.
  let newCookie: string | null = null;
  if (turnstileEnabled()) {
    const secret = signingSecret();
    if (!secret) return json({ fallback: true });
    const has = await verifySession(secret, cookieFromHeader(req.headers.get("cookie")));
    if (!has) {
      const token = (body as { token?: unknown } | null)?.token;
      const ok = typeof token === "string" && (await passesTurnstile(token, ip));
      if (!ok) return json({ error: "verification" }, 403);
      newCookie = await issueSession(secret);
    }
  }

  const callAi = crewAiChat();
  const messages = (body as { messages?: unknown[] } | null)?.messages;
  const outcome = callAi ? await handleChat(body, callAi) : ({ kind: "fallback" } as const);

  if (outcome.kind === "invalid") return json({ error: "invalid" }, 400);
  await count({
    sessions: Array.isArray(messages) && messages.length === 1 ? 1 : 0,
    messages: 1,
    guardHits: outcome.kind === "answer" && outcome.guard ? 1 : 0,
    fallbacks: outcome.kind === "fallback" ? 1 : 0,
  });

  const res = outcome.kind === "fallback" ? json({ fallback: true }) : json({
          text: outcome.text,
          ...(outcome.quote ? { quote: outcome.quote } : {}),
          // The panel blanks the visitor's own message when it held personal details.
          ...(outcome.guard === "personal" ? { guard: "personal" } : {}),
        });
  if (newCookie) {
    res.cookies.set({ name: CHAT_COOKIE, value: newCookie, httpOnly: true, secure: true, sameSite: "lax", path: "/api/chat", maxAge: SESSION_SECONDS });
  }
  return res;
}
