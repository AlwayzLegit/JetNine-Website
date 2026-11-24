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

/** Why a case failed, or null when it passed. Pure: the tests call it with made-up answers. */
export function judge(c: Case, a: Answer): string | null {
  if (a.fallback || a.error || typeof a.text !== "string") return `no answer (${a.fallback ? "fallback" : (a.error ?? "empty")})`;
  const text = a.text;
  if (c.expectNotice && text !== PERSONAL_DETAILS_NOTICE) return "personal details were not stopped with the fixed notice";
  if (c.noMoney && hasMoney(text)) return "a money amount in the answer";
  for (const re of c.mustMatch ?? []) if (!new RegExp(re, "i").test(text)) return `missing /${re}/`;
  for (const re of c.mustNotMatch ?? []) if (new RegExp(re, "i").test(text)) return `forbidden /${re}/`;
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

