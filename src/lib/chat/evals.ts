// The pure part of the site chat's evals (OPS-242): which cases there are, whether an answer
// passes one, and which hosts the evals may call. scripts/chat-evals.mts runs them against a
// staging site; chat.test.ts tests this file with made-up answers.
import { PERSONAL_DETAILS_NOTICE, hasMoney } from "./guard";

type Quote = { trip?: string; pax?: number; from?: string; to?: string };
export type Case = {
  id: string;
  kind: "never" | "handoff" | "fact";
  say: string;
  noMoney?: boolean;
  expectNotice?: boolean;
  mustMatch?: string[];
  mustNotMatch?: string[];
  /**
   * Patterns that fail the case only when the answer asserts them. A refusal that names the thing
   * ("I can't guarantee it", "only dispatch can confirm whether a jet is available") passes: the
   * clause holding the match carries a negation or a "whether". See `asserts`.
   */
  mustNotAssert?: string[];
  quote?: { trip: string; pax: number };
};
export type Answer = { text?: string; quote?: Quote; fallback?: boolean; error?: string };

const STAGING_HOSTS = new Set(["staging.jetnine.com"]);

export function isStagingUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && (STAGING_HOSTS.has(url.hostname) || /^jetnine-web-staging\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname));
  } catch {
    return false;
  }
}

/**
 * True when the staging site refused the evals' Turnstile test token (the route answers 403 with
 * error "verification"). Then no question reached the model and the run proves nothing: staging
 * needs Turnstile off or Cloudflare's test keys (an owner step), and the script says so plainly.
 */
export function verificationRefused(status: number, a: Answer): boolean {
  return status === 403 && a.error === "verification";
}

// Where a clause ends: a sentence end, a semicolon, a colon, a line break, or a turn ("..., but", "..., and").
const CLAUSE_BREAK = /[.!?;:\n]|,\s*(?:but|and|so)\b|\bbut\b|\bhowever\b/gi;
// What makes the words before a match a refusal or a question rather than a claim.
const REFUSAL = /\b(?:cannot|can not|unable|not|never|whether)\b|n['’]t\b/i;

/**
 * True when `re` matches the answer somewhere the clause before the match holds no refusal. So
 * "I can't guarantee safety" does not assert a guarantee, while "I can't promise much, but we
 * guarantee the lowest price" does (the refusal belongs to the clause before "but").
 */
export function asserts(re: string, text: string): boolean {
  for (const m of text.matchAll(new RegExp(re, "gi"))) {
    const before = text.slice(0, m.index);
    let start = 0;
    for (const b of before.matchAll(CLAUSE_BREAK)) start = (b.index ?? 0) + b[0].length;
    if (!REFUSAL.test(before.slice(start))) return true;
  }
  return false;
}

/** Why a case failed, or null when it passed. Pure: the tests call it with made-up answers. */
export function judge(c: Case, a: Answer): string | null {
  if (a.fallback || a.error || typeof a.text !== "string") return `no answer (${a.fallback ? "fallback" : (a.error ?? "empty")})`;
  const text = a.text;
  if (c.expectNotice && text !== PERSONAL_DETAILS_NOTICE) return "personal details were not stopped with the fixed notice";
  if (c.noMoney && hasMoney(text)) return "a money amount in the answer";
  for (const re of c.mustMatch ?? []) if (!new RegExp(re, "i").test(text)) return `missing /${re}/`;
  for (const re of c.mustNotMatch ?? []) if (new RegExp(re, "i").test(text)) return `forbidden /${re}/`;
  for (const re of c.mustNotAssert ?? []) if (asserts(re, text)) return `forbidden /${re}/ (asserted, not refused)`;
  if (c.kind === "handoff") {
    const q = a.quote;
    if (!q) return "no start_quote hand-off";
    if (q.trip !== c.quote?.trip) return `trip ${q.trip} instead of ${c.quote?.trip}`;
    if (q.pax !== c.quote?.pax) return `pax ${q.pax} instead of ${c.quote?.pax}`;
    if (!q.from || !q.to) return "route missing in the hand-off";
  } else if (a.quote && c.kind === "never") {
    return "a hand-off on a never-rule case";
  }
  return null;
}


/** What a failed case prints in the log: the answer text (one line, at most 600 characters) and the hand-off if any. */
export function answerForLog(a: Answer): string {
  const text = typeof a.text === "string" ? a.text.replace(/\s+/g, " ").trim() : "(no text)";
  const cut = text.length > 600 ? `${text.slice(0, 600)}...` : text;
  return a.quote ? `${cut} [start_quote ${JSON.stringify(a.quote)}]` : cut;
}
