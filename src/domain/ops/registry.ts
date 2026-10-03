import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { ApprovalRisk } from "@/db/schema/approvals";
import type { Scope } from "@/lib/api-keys";
import type { Actor } from "@/domain/actor";
import { queueApproval } from "@/domain/approvals/queue";
import { err, ok, type Result } from "@/domain/result";

/**
 * Operations: the one way anything on the desk changes, whether a person
 * clicks a button, a key calls the API, or a person approves what a key
 * proposed. Each op knows its permission, its input shape, the current
 * state it acts on, how risky a given input is, how to describe it in
 * plain words, and how to run.
 *
 * `runOp` is the gate: a key that "asks before acting" never runs a risky
 * input — the op is queued as an approval and the caller gets `pending`.
 */

export type OpSubject = { type: string; id: string | null; code?: string | null };

export type OpDef<I, S = unknown> = {
  /** "request.status", "trip.message" … */
  id: string;
  scope: Scope;
  /** Input shape; a stored proposal is re-parsed with it at approval time. */
  schema: z.ZodType<I>;
  /** Current rows the op acts on. Re-run at approval time so stale proposals fail cleanly. */
  load: (input: I) => Promise<Result<S>>;
  /** null = nobody needs to ask; otherwise who must approve for a supervised key. */
  risk: (input: I, state: S) => ApprovalRisk | null;
  /** One sentence, ≤ 300 chars, for the approval card and History. */
  summary: (input: I, state: S) => string;
  /** The exact text that will go out or change, when there is one. */
  preview?: (input: I, state: S) => string | null;
  subject: (input: I, state: S) => OpSubject;
  /** Text fields a person may edit before approving (nothing else is editable). */
  editable?: (keyof I & string)[];
  run: (actor: Actor, input: I, state: S) => Promise<Result<unknown>>;
  /** Paths to revalidate after a successful run. */
  revalidate?: (input: I, state: S) => string[];
};

export type PendingInfo = { approvalId: string; summary: string; url: string; risk: ApprovalRisk };

export type RunOutcome<T = unknown> = Result<{ kind: "done"; value: T } | { kind: "pending"; pending: PendingInfo }>;

// Hoisted on purpose: area op files call this while the module graph is still loading.
export function defineOp<I, S>(def: OpDef<I, S>): OpDef<I, S> {
  return def;
}

export function approvalUrl(id: string): string {
  return `/admin/messages?tab=approvals&t=approval:${id}`;
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function dedupeKeyFor(opId: string, subject: OpSubject, payload: unknown): string {
  const hash = createHash("sha256").update(stable(payload)).digest("hex").slice(0, 16);
  return `${opId}|${subject.type}:${subject.id ?? subject.code ?? "-"}|${hash}`;
}

/** Revalidate quietly: works in route handlers and Server Actions, no-op elsewhere. */
export function revalidateQuietly(paths: string[]): void {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // outside a request scope (scripts, tests)
    }
  }
}

/**
 * Run an op as an actor, or queue it when the actor is a supervised key
 * and the input is risky. `reason` is the proposer's one-line why.
 */
export async function runOp<I, S>(
  op: OpDef<I, S>,
  actor: Actor,
  rawInput: unknown,
  opts: { reason?: string } = {},
): Promise<RunOutcome> {
  if (!actor.scopes.has(op.scope)) return err("forbidden", `This needs the "${op.scope}" permission.`);

  const parsed = op.schema.safeParse(rawInput);
  if (!parsed.success) return err("invalid", "Invalid input.", parsed.error.issues);
  const input = parsed.data;

  const loaded = await op.load(input);
  if (!loaded.ok) return loaded;
  const state = loaded.value;

  const risk = op.risk(input, state);
  if (risk && actor.via === "api" && actor.key?.supervised) {
    const subject = op.subject(input, state);
    const queued = await queueApproval({
      op: op.id,
      payload: input as Record<string, unknown>,
      summary: op.summary(input, state).slice(0, 300),
      preview: op.preview?.(input, state) ?? null,
      reason: opts.reason?.slice(0, 2000) ?? null,
      risk,
      subject,
      dedupeKey: dedupeKeyFor(op.id, subject, input),
      actor,
    });
    if (!queued.ok) return queued;
    return ok({
      kind: "pending",
      pending: { approvalId: queued.value.id, summary: queued.value.summary, url: approvalUrl(queued.value.id), risk },
    });
  }

  const result = await op.run(actor, input, state);
  if (!result.ok) return result;
  revalidateQuietly(op.revalidate?.(input, state) ?? []);
  return ok({ kind: "done", value: result.value });
}

/** The `{ ok, error }` shape the admin's forms already expect, plus `pending` when queued. */
export type ActionOutcome<T = unknown> =
  | { ok: true; value: T; pending?: undefined }
  | { ok: true; value?: undefined; pending: PendingInfo }
  | { ok: false; error: string };

export function actionOutcome<T>(outcome: RunOutcome<T>): ActionOutcome<T> {
  if (!outcome.ok) return { ok: false, error: outcome.error };
  if (outcome.value.kind === "pending") return { ok: true, pending: outcome.value.pending };
  return { ok: true, value: outcome.value.value as T };
}
