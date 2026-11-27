// Leads pointers (OPS-373, Leads desk Phase 1). After a quote or a contact enquiry is stored, the
// site sends ONE pointer to the Crew's Leads board through the LEADS service binding (crew-intake,
// entrypoint JetNineIntake). The pointer holds no name, phone, email or message text: a source
// word, a short kind, the id of the stored row, a link to the desk page and two times. The site
// holds no key. A refused or missing binding is counted in lead_desk and never fails a submit.
//
// Standard: transactional outbox with at-least-once delivery. The row is stored first, the pointer
// is sent after, and every failed send is counted so health shows it.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, count, eq, gte, max } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { d1Db } from "@/db";
import { leadDesk } from "@/db/d1/schema/lead-desk";

export type PointerResult = { ok: true; pageId: string } | { ok: false; reason: string };
export type LeadsBinding = {
  createLead(input: unknown): Promise<PointerResult>;
  updateLead(input: unknown): Promise<PointerResult>;
};

export type LeadSubject = "quote" | "contact";
export type LeadSourceWord = "Quote" | "Contact" | "Form";
export type LeadScoreWord = "Hot" | "Warm" | "Cold";

export type PointerArgs = {
  subjectType: LeadSubject;
  /** The stored row's id. For a lead that was not stored: "ns-" plus a new uuid. */
  subjectId: string;
  source: LeadSourceWord;
  /** A short label; characters outside the receiver's list are dropped. */
  kind: string;
  receivedAt: Date;
  replyDue: Date | null;
  score: LeadScoreWord | null;
  /** Path of the desk page, no query: "/admin/requests/<id>" or "/admin/messages". */
  adminPath: string;
  status?: "New" | "Not stored";
};

export type PointerDeps = {
  binding: LeadsBinding | null;
  db: DrizzleD1Database | null;
  /** NEXT_PUBLIC_SITE_URL, for the desk link. */
  siteBase: string;
  /** True on staging: every pointer is marked as a rehearsal on the board. */
  rehearsal: boolean;
};

const KIND_CHARS = /[^A-Za-z0-9 /_?=.,:()'-]/g;

export function cleanKind(kind: string): string {
  const k = kind.replace(KIND_CHARS, "").trim().slice(0, 80);
  return k || "lead";
}

/** Hot when the first departure is within 7 days, else Warm. A date that does not parse is Warm. */
export function scoreFor(departDate: string | null | undefined, now: Date): LeadScoreWord {
  if (!departDate) return "Warm";
  const t = Date.parse(`${departDate}T00:00:00Z`);
  if (!Number.isFinite(t)) return "Warm";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((t - today) / 86_400_000);
  return days >= -1 && days <= 7 ? "Hot" : "Warm";
}

/** What crew-intake's createLead takes. Nothing a visitor typed goes in. */
export function buildLeadInput(args: PointerArgs, deps: Pick<PointerDeps, "siteBase" | "rehearsal">) {
  return {
    source: args.source,
    kind: cleanKind(args.kind),
    siteRef: args.subjectId,
    adminUrl: `${deps.siteBase.replace(/\/$/, "")}${args.adminPath}`,
    receivedAt: args.receivedAt.toISOString(),
    replyDue: args.replyDue ? args.replyDue.toISOString() : null,
    score: args.score,
    status: args.status ?? "New",
    rehearsal: deps.rehearsal,
  };
}

/** Sends one pointer and records one lead_desk row. Never throws. Returns the page id when sent. */
export async function sendPointerWith(deps: PointerDeps, args: PointerArgs): Promise<string | null> {
  let pageId: string | null = null;
  try {
    if (deps.binding) {
      const r = await deps.binding.createLead(buildLeadInput(args, deps));
      if (r.ok) pageId = r.pageId;
      else console.warn(`[leads] pointer refused: ${String(r.reason).slice(0, 60)}`);
    } else {
      console.warn("[leads] pointer not sent: no LEADS binding");
    }
  } catch (err) {
    console.warn(`[leads] pointer failed: ${err instanceof Error ? err.name : "error"}`);
  }
  try {
    if (deps.db) {
      await deps.db.insert(leadDesk).values({
        subjectType: args.subjectType,
        subjectId: args.subjectId,
        source: args.source,
        receivedAt: args.receivedAt,
        replyDueAt: args.replyDue,
        pointer: args.status === "Not stored" ? "not_stored" : pageId ? "sent" : "failed",
      });
    }
  } catch (err) {
    console.warn(`[leads] lead_desk row not written: ${err instanceof Error ? err.name : "error"}`);
  }
  return pageId;
}

/** Marks the lead replied on the board. Never throws. */
export async function markRepliedWith(
  deps: Pick<PointerDeps, "binding">,
  subjectId: string,
  at: Date,
): Promise<boolean> {
  try {
    if (!deps.binding) return false;
    const r = await deps.binding.updateLead({ siteRef: subjectId, status: "Replied", firstReplyAt: at.toISOString() });
    return r.ok;
  } catch {
    return false;
  }
}

/** Marks the lead missed because the desk alert could not be sent. Never throws. */
export async function markAlertFailedWith(deps: Pick<PointerDeps, "binding">, subjectId: string): Promise<boolean> {
  try {
    if (!deps.binding) return false;
    const r = await deps.binding.updateLead({ siteRef: subjectId, status: "Missed", missedReason: "Alert failed" });
    return r.ok;
  } catch {
    return false;
  }
}

export type LeadHealth = { lastStoredAt: string | null; failedStores24h: number; failedPointers24h: number };

/** Counts only, from lead_desk. Never a subject id, never a name. */
export async function leadHealthWith(db: DrizzleD1Database, now: Date): Promise<LeadHealth> {
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const [last] = await db.select({ at: max(leadDesk.createdAt) }).from(leadDesk).where(eq(leadDesk.pointer, "sent"));
  const [stores] = await db
    .select({ n: count() })
    .from(leadDesk)
    .where(and(eq(leadDesk.pointer, "not_stored"), gte(leadDesk.createdAt, since)));
  const [fails] = await db
    .select({ n: count() })
    .from(leadDesk)
    .where(and(eq(leadDesk.pointer, "failed"), gte(leadDesk.createdAt, since)));
  const lastAt = last?.at ? new Date(last.at as unknown as number | Date) : null;
  return {
    lastStoredAt: lastAt && Number.isFinite(lastAt.getTime()) ? lastAt.toISOString() : null,
    failedStores24h: stores?.n ?? 0,
    failedPointers24h: fails?.n ?? 0,
  };
}

// ── Real dependencies, read per request ─────────────────────────────────────

function cfEnv(): { LEADS?: LeadsBinding; LEADS_REHEARSAL?: string } | null {
  try {
    return getCloudflareContext().env as { LEADS?: LeadsBinding; LEADS_REHEARSAL?: string };
  } catch {
    return null; // not inside a Cloudflare request
  }
}

export function realDeps(): PointerDeps {
  const env = cfEnv();
  return {
    binding: env?.LEADS ?? null,
    db: d1Db(),
    siteBase: process.env.NEXT_PUBLIC_SITE_URL ?? "https://jetnine.com",
    rehearsal: (env?.LEADS_REHEARSAL ?? process.env.LEADS_REHEARSAL) === "1",
  };
}

/** Runs the work after the response when the platform allows it, else awaits it. Never throws. */
export async function afterResponse(work: Promise<unknown>): Promise<void> {
  const safe = work.then(
    () => undefined,
    () => undefined,
  );
  try {
    getCloudflareContext().ctx.waitUntil(safe);
  } catch {
    await safe;
  }
}

export function sendLeadPointer(args: PointerArgs): Promise<string | null> {
  return sendPointerWith(realDeps(), args);
}

export function markLeadReplied(subjectId: string, at = new Date()): Promise<boolean> {
  return markRepliedWith(realDeps(), subjectId, at);
}

export async function leadHealth(now = new Date()): Promise<LeadHealth | null> {
  const db = d1Db();
  if (!db) return null;
  try {
    return await leadHealthWith(db, now);
  } catch {
    return null;
  }
}
