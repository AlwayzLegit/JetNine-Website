// The core of POST /api/chat (OPS-242), free of Next and Cloudflare so it is
// tested with a stand-in for crew-ai. It validates the visitor's messages, calls
// the shared AI Worker, reads its stream whole, applies the output guard and
// maps the one tool call. No transcript is kept anywhere.
import { guardAnswer, hasPersonalDetails, PERSONAL_DETAILS_NOTICE } from "./guard";
import { buildSystemPrompt } from "./prompt";
import { START_QUOTE_TOOL, toQuoteStart } from "./tool";
import type { QuoteStart } from "@/lib/start-quote";

export const MAX_USER_MESSAGES = 12;
export const MAX_MESSAGES = 24;
export const MAX_CONTENT = 600;
export const MAX_ANSWER = 1200;
export const TIMEOUT_MS = 15_000;
export const HANDOFF_ONLY_TEXT = "Here is your trip, ready for the quote form.";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AiResult =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; reason: "budget" | "invalid" | "upstream" | "timeout" };

/** What the route needs from crew-ai: the service binding's chat method. */
export type CallAi = (input: { system: string; messages: ChatMessage[]; tools: unknown[] }) => Promise<AiResult>;

export type Outcome =
  | { kind: "invalid" }
  | { kind: "fallback" }
  | { kind: "answer"; text: string; quote?: QuoteStart; guard?: "money" | "personal" };

/** The visitor's messages, or null when the body is not what the panel sends. */
export function parseMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_MESSAGES) return null;
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim();
    if (text.length < 1 || text.length > MAX_CONTENT) return null;
    out.push({ role, content: text });
  }
  if (out[out.length - 1].role !== "user") return null;
  if (out.filter((m) => m.role === "user").length > MAX_USER_MESSAGES) return null;
  return out;
}

type Line = { t?: unknown; v?: unknown; name?: unknown; input?: unknown };

/** Reads crew-ai's stream of JSON lines to the end: the text, the first tool call, or an error. */
export async function readStream(stream: ReadableStream<Uint8Array>): Promise<{ text: string; tool?: { name: string; input: unknown }; error: boolean }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let tool: { name: string; input: unknown } | undefined;
  let error = false;
  const take = (line: string) => {
    if (!line.trim()) return;
    let o: Line;
    try {
      o = JSON.parse(line) as Line;
    } catch {
      error = true;
      return;
    }
    if (o.t === "text" && typeof o.v === "string") text += o.v;
    else if (o.t === "tool" && typeof o.name === "string" && !tool) tool = { name: o.name, input: o.input };
    else if (o.t === "error") error = true;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      take(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  take(buf + decoder.decode());
  return { text, tool, error };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

export async function handleChat(body: unknown, callAi: CallAi, timeoutMs = TIMEOUT_MS): Promise<Outcome> {
  const messages = parseMessages(body);
  if (!messages) return { kind: "invalid" };

  // Personal details never go to the model (OWASP LLM02).
  const last = messages[messages.length - 1];
  if (hasPersonalDetails(last.content)) return { kind: "answer", text: PERSONAL_DETAILS_NOTICE, guard: "personal" };

  try {
    const read = await withTimeout(
      (async () => {
        const res = await callAi({ system: buildSystemPrompt(), messages, tools: [START_QUOTE_TOOL] });
        if (!res.ok) return null;
        return readStream(res.stream);
      })(),
      timeoutMs,
    );
    if (!read || read.error) return { kind: "fallback" };

    const quote = read.tool?.name === START_QUOTE_TOOL.name ? (toQuoteStart(read.tool.input) ?? undefined) : undefined;
    const guarded = guardAnswer(read.text.trim().slice(0, MAX_ANSWER));
    let text = guarded.text;
    if (!text) {
      if (!quote) return { kind: "fallback" };
      text = HANDOFF_ONLY_TEXT;
    }
    return { kind: "answer", text, ...(quote ? { quote } : {}), ...(guarded.guarded ? { guard: "money" as const } : {}) };
  } catch {
    return { kind: "fallback" };
  }
}
