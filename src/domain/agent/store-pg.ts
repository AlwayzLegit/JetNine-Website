import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentMemory, agentPlaybooks, agentRunItems, agentRuns } from "@/db/schema/agent";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import type { AgentStore } from "./store";

// The Postgres side of the agent store (OPS-142): the queries that lived in commands.ts and
// queries.ts, moved as they were. The three advisory-lock transactions are unchanged, and a
// race on the one-open-run-per-key index still shows as SQLSTATE 23505.

export function pgAgentStore(): AgentStore {
  return {
    async latestPlaybook() {
      const [row] = await db.select().from(agentPlaybooks).orderBy(desc(agentPlaybooks.version)).limit(1);
      return row;
    },

    async listPlaybookVersions(limit) {
      return db
        .select({ version: agentPlaybooks.version, note: agentPlaybooks.note, createdAt: agentPlaybooks.createdAt, createdBy: agentPlaybooks.createdBy })
        .from(agentPlaybooks)
        .orderBy(desc(agentPlaybooks.version))
        .limit(limit);
    },

    async savePlaybookNextVersion(input) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('agent_playbooks.save'))`);
        const [latest] = await tx.select({ v: agentPlaybooks.version }).from(agentPlaybooks).orderBy(desc(agentPlaybooks.version)).limit(1);
        const next = (latest?.v ?? 0) + 1;
        await tx.insert(agentPlaybooks).values({
          version: next,
          generalMd: input.generalMd,
          jobs: input.jobs,
          note: input.note,
          createdBy: input.createdBy,
        });
        return next;
      });
    },

    async getRun(id) {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
      return run;
    },

    async getRunWithItems(id) {
      const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
      if (!run) return undefined;
      const items = await db.select().from(agentRunItems).where(eq(agentRunItems.runId, id)).orderBy(agentRunItems.createdAt);
      return { ...run, items };
    },

    async openRunForKey(keyId) {
      const [run] = await db
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.keyId, keyId), eq(agentRuns.status, "open")))
        .limit(1);
      return run;
    },

    async insertRun(values) {
      try {
        const [run] = await db.insert(agentRuns).values(values).returning();
        return { run, conflict: false };
      } catch (e) {
        // Two opens raced past the check; the partial unique index won.
        if ((e as { code?: string }).code === "23505" && values.keyId) return { conflict: true };
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
      return updated;
    },

    async failRun(id, values) {
      const [updated] = await db
        .update(agentRuns)
        .set({ status: "failed", closedAt: values.closedAt, summaryMd: values.summaryMd, report: values.report })
        .where(eq(agentRuns.id, id))
        .returning();
      return updated;
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
          itemCount: sql<number>`(select count(*)::int from ${agentRunItems} i where i.run_id = ${agentRuns.id})`,
        })
        .from(agentRuns)
        .orderBy(desc(agentRuns.runDate), desc(agentRuns.startedAt))
        .limit(limit);
      return rows.map((r) => ({ ...r.run, itemCount: Number(r.itemCount ?? 0) }));
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
      // Count, dedupe and insert under one lock so parallel calls can't pass the caps.
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"agent_run_items:" + runId}))`);
        const [{ n }] = await tx.select({ n: count() }).from(agentRunItems).where(eq(agentRunItems.runId, runId));
        if (n >= maxItems) return { ok: false as const, reason: "cap" as const };

        // One open flag per subject across runs: the context already lists it.
        if (input.kind === "flag" && input.subjectType && input.subjectId) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"agent_flag:" + input.subjectType + ":" + input.subjectId}))`);
          const [dupe] = await tx
            .select({ id: agentRunItems.id })
            .from(agentRunItems)
            .where(
              and(
                eq(agentRunItems.kind, "flag"),
                eq(agentRunItems.status, "open"),
                eq(agentRunItems.subjectType, input.subjectType),
                eq(agentRunItems.subjectId, input.subjectId),
              ),
            )
            .limit(1);
          if (dupe) return { ok: false as const, reason: "flag" as const, itemId: dupe.id };
        }

        const [item] = await tx
          .insert(agentRunItems)
          .values({
            runId,
            kind: input.kind,
            subjectType: input.subjectType ?? null,
            subjectId: input.subjectId ?? null,
            subjectCode: input.subjectCode ?? null,
            title: input.title,
            bodyMd: input.bodyMd ?? null,
            url: input.url ?? null,
          })
          .returning();
        return { ok: true as const, item };
      });
    },

    async dismissItem(id, userId, at) {
      const [item] = await db
        .update(agentRunItems)
        .set({ status: "dismissed", dismissedBy: userId, dismissedAt: at })
        .where(and(eq(agentRunItems.id, id), eq(agentRunItems.status, "open")))
        .returning();
      return item;
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

    async subjectStatuses(quoteIds, tripIds) {
      const [quoteRows, tripRows] = await Promise.all([
        quoteIds.length ? db.select({ id: quotes.id, status: quotes.status }).from(quotes).where(inArray(quotes.id, quoteIds)) : [],
        tripIds.length ? db.select({ id: trips.id, status: trips.status }).from(trips).where(inArray(trips.id, tripIds)) : [],
      ]);
      return { quotes: quoteRows, trips: tripRows };
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
      return db
        .select()
        .from(agentMemory)
        .where(includeArchived ? undefined : isNull(agentMemory.archivedAt))
        .orderBy(desc(agentMemory.pinned), desc(agentMemory.updatedAt))
        .limit(includeArchived ? 400 : 200);
    },

    async getMemory(id) {
      const [row] = await db.select().from(agentMemory).where(eq(agentMemory.id, id)).limit(1);
      return row;
    },

    async addMemoryGuarded(values, cap, perRun) {
      // Both caps are checked and the row written under one lock.
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('agent_memory'))`);
        const [{ active }] = await tx.select({ active: count() }).from(agentMemory).where(isNull(agentMemory.archivedAt));
        if (active >= cap) return { ok: false as const, reason: "full" as const };
        if (perRun) {
          const [row] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(agentMemory)
            .where(and(eq(agentMemory.sourceRunId, perRun.runId), eq(agentMemory.author, "agent")));
          if (Number(row?.n ?? 0) >= perRun.max) return { ok: false as const, reason: "perRun" as const };
        }
        const [row] = await tx.insert(agentMemory).values(values).returning();
        return { ok: true as const, row };
      });
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
      return row;
    },

    async memoryAddedInRun(runId) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(agentMemory)
        .where(and(eq(agentMemory.sourceRunId, runId), eq(agentMemory.author, "agent")));
      return Number(row?.n ?? 0);
    },
  };
}

