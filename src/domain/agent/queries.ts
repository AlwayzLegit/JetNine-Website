import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agentMemory,
  agentPlaybooks,
  agentRunItems,
  agentRuns,
  type AgentMemory,
  type AgentPlaybook,
  type AgentRun,
  type AgentRunItem,
  type PlaybookJob,
} from "@/db/schema/agent";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { requestStage, tripState } from "@/lib/desk-status";
import { listPosts } from "@/domain/blog/commands";
import { decidedSince, type Feedback } from "@/domain/approvals/queries";
import { isUuid } from "@/domain/common";
import { deskSnapshot } from "@/domain/desk/queries";
import { healthSnapshot } from "@/domain/settings/queries";
import { STARTER_GENERAL_MD, STARTER_JOBS, jobsDueOn } from "./starter-playbook";

/**
 * What the assistant reads. `agentContext` is the one call a run starts
 * with; everything else is for the Settings › Assistant pages and the
 * narrower endpoints.
 */

const LA = "America/Los_Angeles";
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: LA, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD in Los Angeles. */
export function dayKeyLA(d: Date): string {
  return DAY.format(d);
}

export type Playbook = Pick<AgentPlaybook, "version" | "generalMd" | "jobs" | "note" | "createdAt"> & {
  /** Version 0 is the built-in starter, shown until an owner saves one. */
  starter: boolean;
};

export async function currentPlaybook(): Promise<Playbook> {
  const [row] = await db.select().from(agentPlaybooks).orderBy(desc(agentPlaybooks.version)).limit(1);
  if (row) return { version: row.version, generalMd: row.generalMd, jobs: row.jobs, note: row.note, createdAt: row.createdAt, starter: false };
  return { version: 0, generalMd: STARTER_GENERAL_MD, jobs: STARTER_JOBS, note: null, createdAt: new Date(0), starter: true };
}

export async function listPlaybookVersions(limit = 20): Promise<Pick<AgentPlaybook, "version" | "note" | "createdAt" | "createdBy">[]> {
  return db
    .select({ version: agentPlaybooks.version, note: agentPlaybooks.note, createdAt: agentPlaybooks.createdAt, createdBy: agentPlaybooks.createdBy })
    .from(agentPlaybooks)
    .orderBy(desc(agentPlaybooks.version))
    .limit(limit);
}

export type RunRow = AgentRun & { itemCount: number };

export async function listRuns({ limit = 14 }: { limit?: number } = {}): Promise<RunRow[]> {
  const rows = await db
    .select({
      run: agentRuns,
      itemCount: sql<number>`(select count(*)::int from ${agentRunItems} i where i.run_id = ${agentRuns.id})`,
    })
    .from(agentRuns)
    .orderBy(desc(agentRuns.runDate), desc(agentRuns.startedAt))
    .limit(Math.min(Math.max(limit, 1), 60));
  return rows.map((r) => ({ ...r.run, itemCount: Number(r.itemCount ?? 0) }));
}

export async function getRun(id: string): Promise<(AgentRun & { items: AgentRunItem[] }) | null> {
  if (!isUuid(id)) return null;
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
  if (!run) return null;
  const items = await db.select().from(agentRunItems).where(eq(agentRunItems.runId, id)).orderBy(agentRunItems.createdAt);
  return { ...run, items };
}

export async function openRunForKey(keyId: string): Promise<AgentRun | null> {
  const [run] = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.keyId, keyId), eq(agentRuns.status, "open")))
    .limit(1);
  return run ?? null;
}

export async function listMemory({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<AgentMemory[]> {
  return db
    .select()
    .from(agentMemory)
    .where(includeArchived ? undefined : isNull(agentMemory.archivedAt))
    .orderBy(desc(agentMemory.pinned), desc(agentMemory.updatedAt))
    .limit(includeArchived ? 400 : 200);
}

export type OpenFlag = Pick<AgentRunItem, "id" | "runId" | "subjectType" | "subjectId" | "subjectCode" | "title" | "createdAt"> & {
  /** The subject's current status in the desk's words, so a stale flag is obvious. */
  subjectNow: string | null;
};

export async function listOpenFlags(): Promise<OpenFlag[]> {
  const flags = await db
    .select({
      id: agentRunItems.id,
      runId: agentRunItems.runId,
      subjectType: agentRunItems.subjectType,
      subjectId: agentRunItems.subjectId,
      subjectCode: agentRunItems.subjectCode,
      title: agentRunItems.title,
      createdAt: agentRunItems.createdAt,
    })
    .from(agentRunItems)
    .where(and(eq(agentRunItems.kind, "flag"), eq(agentRunItems.status, "open")))
    .orderBy(desc(agentRunItems.createdAt))
    .limit(100);

  const quoteIds = flags.filter((f) => f.subjectType === "quote" && f.subjectId).map((f) => f.subjectId!);
  const tripIds = flags.filter((f) => f.subjectType === "trip" && f.subjectId).map((f) => f.subjectId!);
  const [quoteRows, tripRows] = await Promise.all([
    quoteIds.length ? db.select({ id: quotes.id, status: quotes.status }).from(quotes).where(inArray(quotes.id, quoteIds)) : [],
    tripIds.length ? db.select({ id: trips.id, status: trips.status }).from(trips).where(inArray(trips.id, tripIds)) : [],
  ]);
  const now = new Map<string, string>();
  for (const q of quoteRows) now.set(q.id, requestStage(q.status).label);
  for (const t of tripRows) now.set(t.id, tripState(t.status).label);
  return flags.map((f) => ({ ...f, subjectNow: f.subjectId ? (now.get(f.subjectId) ?? null) : null }));
}

export type AgentContext = {
  today: string;
  generatedAt: Date;
  playbook: Playbook;
  jobsDue: PlaybookJob[];
  recentRuns: Pick<AgentRun, "id" | "runDate" | "status" | "summaryMd" | "report" | "closedAt">[];
  missedDays: string[];
  memory: Pick<AgentMemory, "id" | "kind" | "body" | "pinned" | "author" | "updatedAt">[];
  /** What people decided about the assistant's proposals since its last closed run (or the last 7 days), rejection notes included. */
  feedback: Feedback[];
  openFlags: OpenFlag[];
  recentPosts: { slug: string; title: string; tags: string[]; publishedAt: Date | null }[];
  desk: Awaited<ReturnType<typeof deskSnapshot>>;
  health: Awaited<ReturnType<typeof healthSnapshot>>;
};

/** Trim a run's report so the whole context stays well under 60 KB. */
function trimRun(r: RunRow): AgentContext["recentRuns"][number] {
  const report = r.report
    ? {
        jobs: r.report.jobs.slice(0, 10).map((j) => ({
          slug: j.slug,
          did: j.did.slice(0, 600),
          ...(j.didnt ? { didnt: j.didnt.slice(0, 300) } : {}),
          ...(j.next ? { next: j.next.slice(0, 300) } : {}),
        })),
        errors: r.report.errors.slice(0, 5).map((e) => e.slice(0, 200)),
      }
    : null;
  return { id: r.id, runDate: r.runDate, status: r.status, summaryMd: r.summaryMd?.slice(0, 1500) ?? null, report, closedAt: r.closedAt };
}

export async function agentContext(now: Date = new Date()): Promise<AgentContext> {
  const today = dayKeyLA(now);
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [playbook, runs, memory, openFlags, posts, desk, health] = await Promise.all([
    currentPlaybook(),
    listRuns({ limit: 7 }),
    listMemory(),
    listOpenFlags(),
    listPosts(),
    deskSnapshot(now),
    healthSnapshot(),
  ]);

  // Feedback covers everything decided since the last closed run, so a
  // skipped day still surfaces its decisions; never less than a week back.
  const weekBack = new Date(now.getTime() - 7 * 86_400_000);
  const lastClosed = runs.find((r) => r.status === "closed")?.closedAt ?? null;
  const feedbackSince = lastClosed && lastClosed < weekBack ? lastClosed : weekBack;
  const feedback = await decidedSince(feedbackSince, { limit: 40 });

  // Days in the last week with no closed run (the assistant should catch up quietly, not loudly).
  const weekAgo = dayKeyLA(new Date(now.getTime() - 7 * 86_400_000));
  const closedDays = await db
    .selectDistinct({ d: agentRuns.runDate })
    .from(agentRuns)
    .where(and(eq(agentRuns.status, "closed"), gte(agentRuns.runDate, weekAgo)));
  const ran = new Set(closedDays.map((r) => r.d));
  const missedDays: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = dayKeyLA(new Date(now.getTime() - i * 86_400_000));
    if (!ran.has(d)) missedDays.push(d);
  }

  return {
    today,
    generatedAt: now,
    playbook,
    jobsDue: jobsDueOn(playbook.jobs, now),
    recentRuns: runs.map(trimRun),
    missedDays,
    memory: memory.slice(0, 60).map((m) => ({ id: m.id, kind: m.kind, body: m.body, pinned: m.pinned, author: m.author, updatedAt: m.updatedAt })),
    feedback,
    openFlags,
    recentPosts: posts
      .filter((p) => p.status === "published" && (p.publishedAt ?? p.createdAt) >= since)
      .map((p) => ({ slug: p.slug, title: p.title, tags: p.tags, publishedAt: p.publishedAt })),
    desk,
    health,
  };
}

/** Memory rows written by the assistant during one run (for the per-run cap). */
export async function memoryAddedInRun(runId: string, tx: Pick<typeof db, "select"> = db): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(agentMemory)
    .where(and(eq(agentMemory.sourceRunId, runId), eq(agentMemory.author, "agent")));
  return Number(row?.n ?? 0);
}

/** True when the run exists, is open and belongs to the key (used to trust X-Agent-Run). */
export async function runIsOpenForKey(runId: string, keyId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: agentRuns.id })
    .from(agentRuns)
    .where(and(eq(agentRuns.id, runId), eq(agentRuns.keyId, keyId), eq(agentRuns.status, "open")))
    .limit(1);
  return Boolean(row);
}
