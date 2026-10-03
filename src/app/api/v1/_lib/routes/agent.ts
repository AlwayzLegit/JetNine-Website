import { z } from "zod";
import { addMemory, addRunItem, closeRun, failRun, openRun, updateMemory } from "@/domain/agent/commands";
import { agentContext, currentPlaybook, getRun, listMemory, listRuns } from "@/domain/agent/queries";
import {
  CloseRun,
  FailRun,
  ListMemoryQuery,
  ListRunsQuery,
  MemoryInput,
  MemoryPatch,
  OpenRun,
  RunItemInput,
} from "@/domain/agent/schemas";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/**
 * The assistant's own endpoints (`agent` permission). A run starts with
 * /agent/context, opens a run, sends X-Agent-Run on every call, records
 * what it produced, and closes the run with a report. Memory is short and
 * capped. Owners edit the playbook from Settings › Assistant, not here.
 */

const TAG = "Assistant";

export const AGENT_ROUTES = {
  agentContext: {
    method: "GET",
    path: "/agent/context",
    operationId: "agentContext",
    summary: "Everything a run needs to start",
    description:
      "Today's date (Los Angeles), the current playbook and which jobs are due today, the last 7 runs with their reports, days with no run in the last week, memory (pinned first), feedback on past proposals, open flags with each subject's current state, posts from the last 30 days, the desk snapshot and site health. Read this first; do not fetch what it already gives you.",
    tag: TAG,
    scope: "agent",
    untrusted: true,
    run: async () => ok({ data: await agentContext() }),
  },
  getPlaybook: {
    method: "GET",
    path: "/agent/playbook",
    operationId: "getPlaybook",
    summary: "The current instructions",
    description: "General instructions plus the job list. Version 0 means the built-in starter, until an owner saves one in Settings › Assistant.",
    tag: TAG,
    scope: "agent",
    run: async () => ok({ data: await currentPlaybook() }),
  },
  listRuns: {
    method: "GET",
    path: "/agent/runs",
    operationId: "listRuns",
    summary: "Recent runs",
    description: "Newest first, with status, summary, report and how many items each produced. `limit` 1–60 (default 14).",
    tag: TAG,
    scope: "agent",
    query: ListRunsQuery,
    run: async ({ query }) => ok({ data: await listRuns({ limit: query.limit as number | undefined }) }),
  },
  openRun: {
    method: "POST",
    path: "/agent/runs",
    operationId: "openRun",
    summary: "Open a run",
    description:
      "Start today's run and get its id; send it as the X-Agent-Run header on every later call. One open run per key: a run left open for 24 hours is marked failed when the next one opens. `runDate` defaults to today in Los Angeles.",
    tag: TAG,
    scope: "agent",
    approval: "never",
    body: OpenRun,
    successStatus: 201,
    run: async ({ actor, body }) => {
      const r = await openRun(actor, body as z.infer<typeof OpenRun>);
      return r.ok ? ok({ data: r.value, status: 201 }) : r;
    },
  },
  getRun: {
    method: "GET",
    path: "/agent/runs/{id}",
    operationId: "getRun",
    summary: "One run with its items",
    tag: TAG,
    scope: "agent",
    untrusted: true,
    run: async ({ params }) => {
      const run = await getRun(params.id);
      return run ? ok({ data: run }) : err("not_found", "No run with that id.");
    },
  },
  closeRun: {
    method: "POST",
    path: "/agent/runs/{id}/close",
    operationId: "closeRun",
    summary: "Close a run with its report",
    description:
      "Send `summaryMd` (the owner's one-minute read) and `report.jobs[]` with, per job: did, worked, didnt, next, metrics. Also `report.errors[]`. A closed run cannot be reopened.",
    tag: TAG,
    scope: "agent",
    approval: "never",
    body: CloseRun,
    run: async ({ actor, params, body }) => {
      const r = await closeRun(actor, params.id, body as z.infer<typeof CloseRun>);
      return r.ok ? ok({ data: r.value }) : r;
    },
  },
  failRun: {
    method: "POST",
    path: "/agent/runs/{id}/fail",
    operationId: "failRun",
    summary: "Give up on a run",
    description: "When the run cannot continue (the API is down, a job loops), close it as failed with a plain reason instead of leaving it open.",
    tag: TAG,
    scope: "agent",
    approval: "never",
    body: FailRun,
    run: async ({ actor, params, body }) => {
      const r = await failRun(actor, params.id, body as z.infer<typeof FailRun>);
      return r.ok ? ok({ data: r.value }) : r;
    },
  },
  addRunItem: {
    method: "POST",
    path: "/agent/runs/{id}/items",
    operationId: "addRunItem",
    summary: "Record something the run produced",
    description:
      "`kind` is post (a published article), flag (something on a request or trip a person should look at), draft (copy for a person to use), note, insight or proposal (an action a person must approve). Give flags and proposals a `subjectType` and `subjectId` (or `subjectCode`). One open flag per subject; a duplicate answers 409 with the existing item id. At most 100 items per run.",
    tag: TAG,
    scope: "agent",
    approval: "never",
    body: RunItemInput,
    successStatus: 201,
    run: async ({ actor, params, body }) => {
      const r = await addRunItem(actor, params.id, body as z.infer<typeof RunItemInput>);
      return r.ok ? ok({ data: r.value, status: 201 }) : r;
    },
  },
  listMemory: {
    method: "GET",
    path: "/agent/memory",
    operationId: "listMemory",
    summary: "The assistant's memory",
    description: "Facts, lessons, preferences and to-dos, pinned first. `includeArchived=true` adds archived items.",
    tag: TAG,
    scope: "agent",
    query: ListMemoryQuery,
    run: async ({ query }) => ok({ data: await listMemory({ includeArchived: query.includeArchived === "true" }) }),
  },
  addMemory: {
    method: "POST",
    path: "/agent/memory",
    operationId: "addMemory",
    summary: "Remember something",
    description:
      "Up to 5 new items per run, 600 characters each, written during an open run (X-Agent-Run). Lessons from rejected or dismissed work matter most. Only owners pin. Memory holds 200 active items; archive what is stale.",
    tag: TAG,
    scope: "agent",
    approval: "never",
    body: MemoryInput,
    successStatus: 201,
    run: async ({ actor, body }) => {
      const r = await addMemory(actor, body as z.infer<typeof MemoryInput>);
      return r.ok ? ok({ data: r.value, status: 201 }) : r;
    },
  },
  updateMemory: {
    method: "PATCH",
    path: "/agent/memory/{id}",
    operationId: "updateMemory",
    summary: "Correct or archive a memory item",
    description: "The assistant may change or archive only what it wrote (`body`, `archived`); owners may also pin.",
    tag: TAG,
    scope: "agent",
    approval: "never",
    body: MemoryPatch,
    run: async ({ actor, params, body }) => {
      const r = await updateMemory(actor, params.id, body as z.infer<typeof MemoryPatch>);
      return r.ok ? ok({ data: r.value }) : r;
    },
  },
} satisfies Record<string, RouteDef>;
