import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { agentMemory, agentPlaybooks, agentRunItems, agentRuns } from "@/db/d1/schema/agent";
import { newId } from "@/db/d1/helpers";
import type { AgentMemory, AgentRun, AgentRunItem } from "@/db/schema/agent";
import type { AgentStore } from "./store";

// The D1 (SQLite) side of the agent store (OPS-142). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema/agent.ts, OPS-100). The client is passed
// in so a test can hand it a real SQLite.
//
// Differences from Postgres: ids are text made by newId(), the timestamps are integer
// milliseconds that drizzle maps to Date, jobs, report and metrics are JSON text, pinned is an
// integer, count(*) is already an integer (no ::int), and the three advisory-lock transactions
// are ONE conditional statement each, insert ... select ... where <caps>. D1 runs a database's
// statements one at a time, so there is no gap between the count and the insert for a second
// call to slip through. A refusal is then explained by one follow-up read (which cap, or which
// flag already holds the subject), so the messages stay exactly as they are on Postgres.

type D1Client = DrizzleD1Database;

// drizzle wraps SQLite errors ("Failed query"), so the reason is read down the cause chain.
function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 4 && e && typeof e === "object"; depth++) {
    const { message, cause } = e as { message?: unknown; cause?: unknown };
    if (typeof message === "string" && /UNIQUE constraint failed/i.test(message)) return true;
    e = cause;
  }
  return false;
}

const asRun = (r: unknown) => r as AgentRun;
const asItem = (r: unknown) => r as AgentRunItem;
const asMemory = (r: unknown) => r as AgentMemory;

export function d1AgentStore(db: D1Client): AgentStore {
  return {
    async latestPlaybook() {
      const [row] = await db.select().from(agentPlaybooks).orderBy(desc(agentPlaybooks.version)).limit(1);
      return row as never;
    },

    async listPlaybookVersions(limit) {
      return db
        .select({ version: agentPlaybooks.version, note: agentPlaybooks.note, createdAt: agentPlaybooks.createdAt, createdBy: agentPlaybooks.createdBy })
        .from(agentPlaybooks)
        .orderBy(desc(agentPlaybooks.version))
        .limit(limit);
    },

    async savePlaybookNextVersion(input) {
      // One statement: the next version is read and written together, and the unique version
      // is the backstop.
      const id = newId();
      await db.run(sql`
        insert into agent_playbooks (id, version, general_md, jobs, note, created_by, created_at)
        select ${id}, coalesce(max(version), 0) + 1, ${input.generalMd}, ${JSON.stringify(input.jobs)},
               ${input.note}, ${input.createdBy}, ${Date.now()}
        from agent_playbooks
      `);
      const [row] = await db.select({ v: agentPlaybooks.version }).from(agentPlaybooks).where(eq(agentPlaybooks.id, id)).limit(1);
      if (!row) throw new Error("savePlaybookNextVersion: the row was not written");
      return row.v;
    },

    async getRun(id) {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
      return run ? asRun(run) : undefined;
    },

    async getRunWithItems(id) {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
      if (!run) return undefined;
      const items = await db.select().from(agentRunItems).where(eq(agentRunItems.runId, id)).orderBy(agentRunItems.createdAt);
      return { ...asRun(run), items: items.map(asItem) };
    },

    async openRunForKey(keyId) {
      const [run] = await db
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.keyId, keyId), eq(agentRuns.status, "open")))
        .limit(1);
      return run ? asRun(run) : undefined;
    },

    async insertRun(values) {
      try {
        const [run] = await db.insert(agentRuns).values(values).returning();
        return { run: asRun(run), conflict: false };
      } catch (e) {
        // Two opens raced past the check; the partial unique index won.
        if (isUniqueViolation(e) && values.keyId) return { conflict: true };
        throw e;
      }
    },

    async failRunLeftOpen(id, closedAt, summaryMd) {
      await db.update(agentRuns).set({ status: "failed", closedAt, summaryMd }).where(eq(agentRuns.id, id));
    },

    async closeRun(id, values) {
      const [updated] = await db
        .update(agentRuns)
        .set({ status: "closed", closedAt: values.closedAt, summaryMd: values.summaryMd, report: values.report, metrics: values.metrics })
        .where(eq(agentRuns.id, id))
        .returning();
      return asRun(updated);
    },

    async failRun(id, values) {
      const [updated] = await db
        .update(agentRuns)
        .set({ status: "failed", closedAt: values.closedAt, summaryMd: values.summaryMd, report: values.report })
        .where(eq(agentRuns.id, id))
        .returning();
      return asRun(updated);
    },

    async failStaleRuns(cutoff, now) {
      const rows = await db
        .update(agentRuns)
        .set({ status: "failed", closedAt: now, summaryMd: "Left open; closed automatically." })
        .where(and(eq(agentRuns.status, "open"), lt(agentRuns.startedAt, cutoff)))
        .returning({ id: agentRuns.id });
      return rows.length;
    },

    async listRunsWithCounts(limit) {
      const rows = await db
        .select({
          run: agentRuns,
          // "agent_runs"."id" is written out: drizzle drops the table name on a one-table select, and a bare "id" would bind to the item row.
          itemCount: sql<number>`(select count(*) from ${agentRunItems} i where i.run_id = "agent_runs"."id")`,
        })
        .from(agentRuns)
        .orderBy(desc(agentRuns.runDate), desc(agentRuns.startedAt))
        .limit(limit);
      return rows.map((r) => ({ ...asRun(r.run), itemCount: Number(r.itemCount ?? 0) }));
    },

    async closedRunDatesSince(fromDay) {
      const rows = await db
        .selectDistinct({ d: agentRuns.runDate })
        .from(agentRuns)
        .where(and(eq(agentRuns.status, "closed"), gte(agentRuns.runDate, fromDay)));
      return rows.map((r) => r.d);
    },

    async runIsOpenForKey(runId, keyId) {
      const [row] = await db
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(and(eq(agentRuns.id, runId), eq(agentRuns.keyId, keyId), eq(agentRuns.status, "open")))
        .limit(1);
      return Boolean(row);
    },

    async addItemGuarded(runId, input, maxItems) {
      const flagSubject = input.kind === "flag" && input.subjectType && input.subjectId ? { type: input.subjectType, id: input.subjectId } : null;
      const attempt = async (): Promise<string | null> => {
        const id = newId();
        const noOpenFlag = flagSubject
          ? sql`and not exists (
              select 1 from agent_run_items
              where kind = 'flag' and status = 'open' and subject_type = ${flagSubject.type} and subject_id = ${flagSubject.id}
            )`
          : sql``;
        await db.run(sql`
          insert into agent_run_items (id, run_id, kind, subject_type, subject_id, subject_code, title, body_md, url, status, created_at)
          select ${id}, ${runId}, ${input.kind}, ${input.subjectType ?? null}, ${input.subjectId ?? null}, ${input.subjectCode ?? null},
                 ${input.title}, ${input.bodyMd ?? null}, ${input.url ?? null}, 'open', ${Date.now()}
          where (select count(*) from agent_run_items where run_id = ${runId}) < ${maxItems}
          ${noOpenFlag}
        `);
        const [row] = await db.select().from(agentRunItems).where(eq(agentRunItems.id, id)).limit(1);
        return row ? id : null;
      };

      for (let tries = 0; tries < 2; tries++) {
        const id = await attempt();
        if (id) {
          const [item] = await db.select().from(agentRunItems).where(eq(agentRunItems.id, id)).limit(1);
          return { ok: true, item: asItem(item) };
        }
        // Refused: say which rule, as Postgres does (the run's cap first, then the open flag).
        const [{ n }] = await db.select({ n: count() }).from(agentRunItems).where(eq(agentRunItems.runId, runId));
        if (n >= maxItems) return { ok: false, reason: "cap" };
        if (flagSubject) {
          const [dupe] = await db
            .select({ id: agentRunItems.id })
            .from(agentRunItems)
            .where(
              and(
                eq(agentRunItems.kind, "flag"),
                eq(agentRunItems.status, "open"),
                eq(agentRunItems.subjectType, flagSubject.type),
                eq(agentRunItems.subjectId, flagSubject.id),
              ),
            )
            .limit(1);
          if (dupe) return { ok: false, reason: "flag", itemId: dupe.id };
        }
        // Neither rule holds any more (the blocking row changed in between): try once more.
      }
      return { ok: false, reason: "cap" };
    },

    async dismissItem(id, userId, at) {
      const [item] = await db
        .update(agentRunItems)
        .set({ status: "dismissed", dismissedBy: userId, dismissedAt: at })
        .where(and(eq(agentRunItems.id, id), eq(agentRunItems.status, "open")))
        .returning();
      return item ? asItem(item) : undefined;
    },

    async openFlags() {
      return db
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
    },

    async itemsForSubject(subjectType, subjectId, includeDismissed) {
      return db
        .select({
          id: agentRunItems.id,
          kind: agentRunItems.kind,
          title: agentRunItems.title,
          bodyMd: agentRunItems.bodyMd,
          url: agentRunItems.url,
          status: agentRunItems.status,
          createdAt: agentRunItems.createdAt,
          dismissedAt: agentRunItems.dismissedAt,
          runDate: agentRuns.runDate,
        })
        .from(agentRunItems)
        .innerJoin(agentRuns, eq(agentRuns.id, agentRunItems.runId))
        .where(
          and(
            eq(agentRunItems.subjectType, subjectType),
            eq(agentRunItems.subjectId, subjectId),
            includeDismissed ? undefined : eq(agentRunItems.status, "open"),
          ),
        )
        .orderBy(desc(agentRunItems.createdAt))
        .limit(20);
    },

    async listMemory(includeArchived) {
      const rows = await db
        .select()
        .from(agentMemory)
        .where(includeArchived ? undefined : isNull(agentMemory.archivedAt))
        .orderBy(desc(agentMemory.pinned), desc(agentMemory.updatedAt))
        .limit(includeArchived ? 400 : 200);
      return rows.map(asMemory);
    },

    async getMemory(id) {
      const [row] = await db.select().from(agentMemory).where(eq(agentMemory.id, id)).limit(1);
      return row ? asMemory(row) : undefined;
    },

    async addMemoryGuarded(values, cap, perRun) {
      const id = newId();
      const at = Date.now();
      const perRunCap = perRun
        ? sql`and (select count(*) from agent_memory where source_run_id = ${perRun.runId} and author = 'agent') < ${perRun.max}`
        : sql``;
      await db.run(sql`
        insert into agent_memory (id, kind, body, pinned, author, source_run_id, created_by, created_at, updated_at)
        select ${id}, ${values.kind}, ${values.body}, ${values.pinned ? 1 : 0}, ${values.author}, ${values.sourceRunId},
               ${values.createdBy ?? null}, ${at}, ${at}
        where (select count(*) from agent_memory where archived_at is null) < ${cap}
        ${perRunCap}
      `);
      const [row] = await db.select().from(agentMemory).where(eq(agentMemory.id, id)).limit(1);
      if (row) return { ok: true, row: asMemory(row) };
      // Refused: the memory cap first, as on Postgres, else the per-run cap.
      const [{ active }] = await db.select({ active: count() }).from(agentMemory).where(isNull(agentMemory.archivedAt));
      return { ok: false, reason: active >= cap ? "full" : "perRun" };
    },

    async updateMemory(id, change, at) {
      const [row] = await db
        .update(agentMemory)
        .set({
          ...(change.body !== undefined ? { body: change.body } : {}),
          ...(change.pinned !== undefined ? { pinned: change.pinned } : {}),
          ...(change.archived !== undefined ? { archivedAt: change.archived ? at : null } : {}),
          updatedAt: at,
        })
        .where(eq(agentMemory.id, id))
        .returning();
      return asMemory(row);
    },

    async memoryAddedInRun(runId) {
      const [row] = await db
        .select({ n: count() })
        .from(agentMemory)
        .where(and(eq(agentMemory.sourceRunId, runId), eq(agentMemory.author, "agent")));
      return Number(row?.n ?? 0);
    },
  };
}
