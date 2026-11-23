import type { NewAuditLog } from "@/db/schema/audit";
import { logAudit } from "@/lib/audit";
import type { SendResult } from "@/lib/email";

// OPS-279: every desk alert records whether it was delivered, the way the contact inquiry
// (contact_inquiry.notify.email) and quote (quote.notify.email) alerts already do.
// sendDispatchAlert returns a SendResult and does not throw on a failed send, so a caller that
// drops the result leaves a failed alert silent. Metadata holds only status, provider, the
// provider's message id, the provider's error text and a recipient count: nothing a visitor
// typed, no address, no phone number, no message text (OWASP Logging Cheat Sheet).

type SubjectType = NewAuditLog["subjectType"];

export type DeskAlertResult = SendResult | PromiseSettledResult<SendResult>;

export type DeskAlertAuditInput = {
  /** Always ends in ".notify.email" so desk-alerts.yml finds it. */
  action: string;
  subjectType: SubjectType;
  subjectId?: string | null;
  subjectCode?: string | null;
  result: DeskAlertResult;
  /** How many staff addresses came on top of the shared inbox. A count, never the addresses. */
  staffRecipients: number;
  /** Extra non-personal keys (a Twilio call sid, a channel, counts). Never an address or a phone number. */
  extra?: Record<string, string | number | boolean | null>;
};

export type DeskAlertStatus = "ok" | "error" | "rejected";

function isSettled(r: DeskAlertResult): r is PromiseSettledResult<SendResult> {
  return "status" in r && (r.status === "fulfilled" || r.status === "rejected");
}

/** The audit row for one alert result. Pure, so a test can insert it into a real database. */
export function deskAlertAuditRow(input: DeskAlertAuditInput): {
  row: Omit<NewAuditLog, "id" | "occurredAt">;
  status: DeskAlertStatus;
} {
  const { result, staffRecipients } = input;
  let metadata: Record<string, unknown>;
  let status: DeskAlertStatus;

  if (isSettled(result) && result.status === "rejected") {
    status = "rejected";
    metadata = { status, error: String(result.reason).slice(0, 300), staffRecipients };
  } else {
    const send: SendResult = isSettled(result) ? (result as PromiseFulfilledResult<SendResult>).value : result;
    if (send.ok) {
      status = "ok";
      metadata = { status, provider: send.provider, messageId: send.messageId ?? null, staffRecipients };
    } else {
      status = "error";
      metadata = { status, error: String(send.error).slice(0, 300), staffRecipients };
    }
  }
  if (input.extra) metadata = { ...metadata, ...input.extra };

  return {
    status,
    row: {
      actorUserId: null,
      actorRole: "system",
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      subjectCode: input.subjectCode ?? null,
      metadata,
    },
  };
}

/**
 * Record the outcome of one desk alert. Never throws: an alert or audit failure must not change
 * what the visitor, Twilio or Postmark gets back. A failed or rejected alert also leaves one
 * console line with the action and status only.
 */
export async function auditDeskAlert(input: DeskAlertAuditInput): Promise<void> {
  try {
    const { row, status } = deskAlertAuditRow(input);
    if (status !== "ok") console.error(`[desk-alert] ${input.action} ${status}`);
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: row.action,
      subjectType: row.subjectType,
      subjectId: row.subjectId ?? null,
      subjectCode: row.subjectCode ?? null,
      metadata: row.metadata ?? null,
    });
  } catch (err) {
    console.error("[desk-alert] audit failed (non-fatal)", err);
  }
}
