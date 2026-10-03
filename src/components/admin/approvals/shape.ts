import { TEAM_APPROVABLE_RISKS, type ApprovalRisk } from "@/db/schema/approvals";
import type { ApprovalRow } from "@/domain/approvals/queries";
import { getOp } from "@/domain/ops";
import { whenWords } from "@/lib/desk-history";
import type { ApprovalCardData } from "@/components/admin/approval-card";
import { editableFieldLabel } from "@/components/admin/messages/words";

/**
 * Server-side shaping for the "Needs your OK" card: dates become words,
 * the op's editable fields become labelled text, and the role check
 * happens here so the client component only gets `canDecide`.
 */

/** Who proposed it, in words: the key's name, else "Desk". */
export function proposerName(row: Pick<ApprovalRow, "requestedByName">): string {
  return row.requestedByName?.trim() || "Desk";
}

/** Owners decide anything; team members only what contacts a client or changes content. */
export function canDecideApproval(role: string, risk: ApprovalRisk): boolean {
  if (role === "admin" || role === "superadmin") return true;
  if (role === "dispatcher") return TEAM_APPROVABLE_RISKS.has(risk);
  return false;
}

export function approvalSubjectLink(row: Pick<ApprovalRow, "subjectType" | "subjectId" | "subjectCode">): { href: string; label: string } | null {
  if (!row.subjectId) return null;
  const code = row.subjectCode ? ` ${row.subjectCode}` : "";
  if (row.subjectType === "quote") return { href: `/admin/requests/${row.subjectId}`, label: `Open request${code}` };
  if (row.subjectType === "trip") return { href: `/admin/trips/${row.subjectId}`, label: `Open trip${code}` };
  return null;
}

/** "in 6 days" / "in 3 h" / "within the hour" for the expiry line. */
function expiresWords(at: Date, now: Date): string {
  const min = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (min < 60) return "within the hour";
  const h = Math.round(min / 60);
  if (h < 24) return `in ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "tomorrow" : `in ${d} days`;
}

export function approvalCardData(row: ApprovalRow, { now, role }: { now: Date; role: string }): ApprovalCardData {
  const editable = getOp(row.op)?.editable ?? [];
  const payload = (row.editedPayload ?? row.payload) as Record<string, unknown>;
  return {
    id: row.id,
    summary: row.summary,
    risk: row.risk,
    status: row.status,
    reason: row.reason,
    preview: row.preview,
    editableText: editable.map((field) => ({
      field,
      label: editableFieldLabel(field),
      text: typeof payload[field] === "string" ? (payload[field] as string) : "",
    })),
    proposedBy: proposerName(row),
    proposedWhen: whenWords(row.createdAt, now),
    expiresWhen: row.status === "pending" ? expiresWords(row.expiresAt, now) : null,
    subject: approvalSubjectLink(row),
    decidedBy: row.decidedByName,
    decidedWhen: row.decidedAt ? whenWords(row.decidedAt, now) : null,
    decisionNote: row.decisionNote,
    error: row.error,
    edited: row.editedPayload !== null && row.editedPayload !== undefined,
    canDecide: canDecideApproval(role, row.risk),
  };
}
