import { inArray } from "drizzle-orm";
import { db } from "@/db";
import {
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
import { agentStore } from "./store";

/**
 * What the assistant reads. `agentContext` is the one call a run starts
 * with; everything else is for the Settings › Assistant pages and the
 * narrower endpoints. The assistant's own tables are read through the agent
 * store (store.ts, OPS-142), Postgres or D1 by dbTarget(); the quote and trip
 * statuses behind a flag, the blog, the desk and the health snapshot stay on
 * their own domains.
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
  const row = await agentStore().latestPlaybook();
  if (row) return { version: row.version, generalMd: row.generalMd, jobs: row.jobs, note: row.note, createdAt: row.createdAt, starter: false };
  return { version: 0, generalMd: STARTER_GENERAL_MD, jobs: STARTER_JOBS, note: null, createdAt: new Date(0), starter: true };
}

export async function listPlaybookVersions(limit = 20): Promise<Pick<AgentPlaybook, "version" | "note" | "createdAt" | "createdBy">[]> {
  return agentStore().listPlaybookVersions(limit);
}

export type RunRow = AgentRun & { itemCount: number };

export async function listRuns({ limit = 14 }: { limit?: number } = {}): Promise<RunRow[]> {
  return agentStore().listRunsWithCounts(Math.min(Math.max(limit, 1), 60));
}

export async function getRun(id: string): Promise<(AgentRun & { items: AgentRunItem[] }) | null> {
  if (!isUuid(id)) return null;
  return (await agentStore().getRunWithItems(id)) ?? null;
}

export async function openRunForKey(keyId: string): Promise<AgentRun | null> {
  return (await agentStore().openRunForKey(keyId)) ?? null;
}

export async function listMemory({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<AgentMemory[]> {
  return agentStore().listMemory(includeArchived);
}

export type OpenFlag = Pick<AgentRunItem, "id" | "runId" | "subjectType" | "subjectId" | "subjectCode" | "title" | "createdAt"> & {
  /** The subject's current status in the desk's words, so a stale flag is obvious. */
  subjectNow: string | null;
};

export async function listOpenFlags(): Promise<OpenFlag[]> {
  const flags = await agentStore().openFlags();

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

export type SubjectItem = Pick<AgentRunItem, "id" | "kind" | "title" | "bodyMd" | "url" | "status" | "createdAt" | "dismissedAt"> & {
  /** YYYY-MM-DD of the run that produced the item. */
  runDate: string;
};

/**
 * What the assistant said about one request or trip, newest first, for the
 * "Assistant notes" card on its page. Open items only unless asked.
 */
export async function itemsForSubject(
  subjectType: string,
  subjectId: string,
  { includeDismissed = false }: { includeDismissed?: boolean } = {},
): Promise<SubjectItem[]> {
  if (!isUuid(subjectId)) return [];
  return agentStore().itemsForSubject(subjectType, subjectId, includeDismissed);
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

/** Days in the last week (LA calendar) with no closed run: the assistant catches up quietly, the owner sees them on Today. */
export async function missedRunDays(now: Date = new Date()): Promise<string[]> {
  const weekAgo = dayKeyLA(new Date(now.getTime() - 7 * 86_400_000));
  const ran = new Set(await agentStore().closedRunDatesSince(weekAgo));
  const missed: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = dayKeyLA(new Date(now.getTime() - i * 86_400_000));
    if (!ran.has(d)) missed.push(d);
  }
  return missed;
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

  const missedDays = await missedRunDays(now);

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
export async function memoryAddedInRun(runId: string): Promise<number> {
  return agentStore().memoryAddedInRun(runId);
}

/** True when the run exists, is open and belongs to the key (used to trust X-Agent-Run). */
export async function runIsOpenForKey(runId: string, keyId: string): Promise<boolean> {
  return agentStore().runIsOpenForKey(runId, keyId);
}
