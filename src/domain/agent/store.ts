import { d1Db, dbTarget } from "@/db";
import type { AgentMemory, AgentPlaybook, AgentRun, AgentRunItem, MemoryKind, PlaybookJob, RunItemKind, RunReport } from "@/db/schema/agent";
import { d1AgentStore } from "./store-d1";
import { pgAgentStore } from "./store-pg";

// The one door to the assistant's four tables (OPS-142): agent_playbooks, agent_runs,
// agent_run_items and agent_memory. Every query on them goes through an AgentStore: open, close
// and fail a run, add and dismiss a run item, add and change memory, save a playbook, the stale
// run sweep of the maintenance cron, the run list, the open flags, the items on a request or trip
// page, the closed-run days and the X-Agent-Run check. There is one adapter per database, chosen
// per request by dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging first;
// the code refuses "d1" in production, see src/db/target.mjs).
//
// The three Postgres advisory-lock transactions (run items, memory, playbook version) become one
// conditional statement each on D1, which runs one statement at a time, so the caps cannot be
// raced. The rules (who may do what, the messages, the audit calls) stay in commands.ts and
// queries.ts. Lookups into quotes, trips and approvals, the blog, the desk and the health snapshot
// stay where they are; they move with their own rows.

export type NewRun = { runDate: string; keyId: string | null; playbookVersion: number };

/** An item to add; the id, status and time are made by the adapter. */
export type NewItem = {
  kind: RunItemKind;
  subjectType?: string | null;
  subjectId?: string | null;
  subjectCode?: string | null;
  title: string;
  bodyMd?: string | null;
  url?: string | null;
};

export type AddItemResult =
  | { ok: true; item: AgentRunItem }
  | { ok: false; reason: "cap" }
  | { ok: false; reason: "flag"; itemId: string };

export type NewMemory = {
  kind: MemoryKind;
  body: string;
  pinned: boolean;
  author: "agent" | "owner";
  sourceRunId: string | null;
  createdBy: string | null | undefined;
};

export type AddMemoryResult = { ok: true; row: AgentMemory } | { ok: false; reason: "full" | "perRun" };

export type MemoryChange = { body?: string; pinned?: boolean; archived?: boolean };

export type RunWithCount = AgentRun & { itemCount: number };

export type FlagRaw = Pick<AgentRunItem, "id" | "runId" | "subjectType" | "subjectId" | "subjectCode" | "title" | "createdAt">;

export type SubjectItemRaw = Pick<AgentRunItem, "id" | "kind" | "title" | "bodyMd" | "url" | "status" | "createdAt" | "dismissedAt"> & {
  runDate: string;
};

export interface AgentStore {
  /** The highest playbook version, or undefined before an owner saved one. */
  latestPlaybook(): Promise<AgentPlaybook | undefined>;
  listPlaybookVersions(limit: number): Promise<Pick<AgentPlaybook, "version" | "note" | "createdAt" | "createdBy">[]>;
  /** Save as version max + 1, safe against two saves together; the new version. */
  savePlaybookNextVersion(input: { generalMd: string; jobs: PlaybookJob[]; note: string | null; createdBy: string }): Promise<number>;

  getRun(id: string): Promise<AgentRun | undefined>;
  /** A run and its items, oldest item first. */
  getRunWithItems(id: string): Promise<(AgentRun & { items: AgentRunItem[] }) | undefined>;
  /** The open run of a key, if any. */
  openRunForKey(keyId: string): Promise<AgentRun | undefined>;
  /** Insert an open run. conflict is true when the key already has one (two opens raced). */
  insertRun(values: NewRun): Promise<{ run: AgentRun; conflict: false } | { run?: undefined; conflict: true }>;
  /** Mark a run failed (a run left open for a day, closed when the next one starts). */
  failRunLeftOpen(id: string, closedAt: Date, summaryMd: string): Promise<void>;
  closeRun(id: string, values: { closedAt: Date; summaryMd: string; report: RunReport; metrics: Record<string, number | string> | null }): Promise<AgentRun>;
  failRun(id: string, values: { closedAt: Date; summaryMd: string; report: RunReport }): Promise<AgentRun>;
  /** Runs open since before the cutoff become failed; how many. */
  failStaleRuns(cutoff: Date, now: Date): Promise<number>;
  /** Newest first, each with its item count. */
  listRunsWithCounts(limit: number): Promise<RunWithCount[]>;
  /** The distinct run dates of closed runs on or after `fromDay` (YYYY-MM-DD). */
  closedRunDatesSince(fromDay: string): Promise<string[]>;
  /** True when the run exists, is open and belongs to the key. */
  runIsOpenForKey(runId: string, keyId: string): Promise<boolean>;

  /**
   * Add an item unless the run holds `maxItems` already ("cap") or, for a flag with a subject,
   * that subject already has an open flag ("flag", with that flag's id). Safe against two adds together.
   */
  addItemGuarded(runId: string, input: NewItem, maxItems: number): Promise<AddItemResult>;
  /** Dismiss an open item; undefined when it is not open (or unknown). */
  dismissItem(id: string, userId: string, at: Date): Promise<AgentRunItem | undefined>;
  /** Open flags, newest first, at most 100. */
  openFlags(): Promise<FlagRaw[]>;
  /** Items about one subject, newest first, at most 20, with the date of the run that made them. */
  itemsForSubject(subjectType: string, subjectId: string, includeDismissed: boolean): Promise<SubjectItemRaw[]>;

  listMemory(includeArchived: boolean): Promise<AgentMemory[]>;
  getMemory(id: string): Promise<AgentMemory | undefined>;
  /**
   * Add memory unless `cap` active items exist ("full") or, when perRun is given, that run already
   * wrote `perRun.max` ("perRun"). Safe against two adds together.
   */
  addMemoryGuarded(values: NewMemory, cap: number, perRun: { runId: string; max: number } | null): Promise<AddMemoryResult>;
  updateMemory(id: string, change: MemoryChange, at: Date): Promise<AgentMemory>;
  /** Memory rows the assistant wrote during one run. */
  memoryAddedInRun(runId: string): Promise<number>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function agentStore(): AgentStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1AgentStore(client);
  }
  return pgAgentStore();
}
