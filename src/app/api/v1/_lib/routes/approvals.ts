import { z } from "zod";
import { APPROVAL_STATUSES, type ApprovalStatus } from "@/db/schema/approvals";
import { getApproval, listApprovals, type ApprovalRow } from "@/domain/approvals/queries";
import { approvalUrl } from "@/domain/ops/registry";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/**
 * The approval queue, read-only. A supervised key sees what it proposed
 * and what a person decided; deciding itself is never over the API.
 * Staff names and user ids stay out: the proposer is the key's name or
 * "Desk", and the decision is just its time and note.
 */

const TAG = "Approvals";

function approvalOut(a: ApprovalRow) {
  return {
    id: a.id,
    op: a.op,
    summary: a.summary,
    preview: a.preview,
    reason: a.reason,
    risk: a.risk,
    status: a.status,
    subject: { type: a.subjectType, id: a.subjectId, code: a.subjectCode },
    payload: a.payload,
    editedPayload: a.editedPayload ?? null,
    requestedBy: a.requestedByName ?? "Desk",
    decidedAt: a.decidedAt,
    decisionNote: a.decisionNote,
    result: a.result ?? null,
    error: a.error,
    expiresAt: a.expiresAt,
    createdAt: a.createdAt,
    url: approvalUrl(a.id),
  };
}

export const APPROVAL_ROUTES = {
  listApprovals: {
    method: "GET",
    path: "/approvals",
    operationId: "listApprovals",
    summary: "List approvals",
    description:
      "Things a key that asks before acting proposed, waiting for or decided by a person in Messages › Needs your OK. `status` picks one state (pending by default; executing, executed, failed, rejected, expired). Newest first, at most 200. `payload` is what was proposed, `editedPayload` what a person changed before approving, `result` what the operation returned once it ran.",
    tag: TAG,
    scope: "read",
    query: z.object({
      status: z.enum(APPROVAL_STATUSES).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }),
    run: async ({ query }) => {
      const status = (query.status as ApprovalStatus | undefined) ?? "pending";
      const rows = await listApprovals({ status: [status], limit: query.limit as number | undefined });
      return ok({ data: rows.map(approvalOut), meta: { status, total: rows.length } });
    },
  },
  getApproval: {
    method: "GET",
    path: "/approvals/{id}",
    operationId: "getApproval",
    summary: "Get one approval",
    description: "One proposal with its state, what was proposed, the decision and what happened when it ran.",
    tag: TAG,
    scope: "read",
    run: async ({ params }) => {
      const a = await getApproval(params.id);
      return a ? ok({ data: approvalOut(a) }) : err("not_found", "No approval with that id.");
    },
  },
} satisfies Record<string, RouteDef>;
