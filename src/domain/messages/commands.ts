import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { contactInquiries } from "@/db/schema/contact";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { logAudit } from "@/lib/audit";
import type { ThreadChannel } from "@/lib/message-delivery";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import type { InquiryStatusInput, MarkThreadReadInput, MessageRetryInput } from "./schemas";

/**
 * Message commands, shared by the admin's Server Actions, the API and the
 * approval queue through the ops in ./ops.ts. Each op has a `load*` (the
 * current rows, re-read at approval time) and a command that runs against
 * that state. Nothing here checks the session or revalidates: the op
 * declares its paths and `runOp` handles both.
 *
 * The error strings are the codes the Messages page already matches on
 * (NOT_FOUND, NOT_FAILED …), so the Server Action wrappers pass them
 * through verbatim.
 *
 * Keep this file free of `server-only` imports: scripts/check-api.mts
 * loads the route registry under tsx. The transports are reached through
 * a dynamic import.
 */

// ─── Resend a failed delivery ────────────────────────────────────────────

export type MessageRetryState = {
  message: {
    id: string;
    /** Only request and trip threads carry a code for the subject line. */
    subjectType: "quote" | "trip";
    subjectId: string;
    channel: ThreadChannel;
    toAddress: string;
    body: string;
    preview: string | null;
  };
  /** JN-… code of the request or trip, for the email subject and the audit row. */
  subjectCode: string;
};

export async function loadMessageForRetry(input: MessageRetryInput): Promise<Result<MessageRetryState>> {
  if (!isUuid(input.id)) return err("not_found", "NOT_FOUND");

  const [m] = await db
    .select({
      id: messages.id,
      subjectType: messages.subjectType,
      subjectId: messages.subjectId,
      channel: messages.channel,
      direction: messages.direction,
      toAddress: messages.toAddress,
      body: messages.body,
      preview: messages.preview,
      deliveryStatus: messages.deliveryStatus,
    })
    .from(messages)
    .where(eq(messages.id, input.id));

  if (!m) return err("not_found", "NOT_FOUND");
  if (m.direction !== "out") return err("conflict", "NOT_OUTBOUND");
  if (m.channel !== "email" && m.channel !== "sms" && m.channel !== "whatsapp") {
    return err("conflict", "ONLY_EMAIL_SMS_OR_WHATSAPP");
  }
  if (!m.toAddress) return err("conflict", "NO_RECIPIENT");
  if (!m.body) return err("conflict", "NO_BODY");
  if (m.deliveryStatus !== "failed") return err("conflict", "NOT_FAILED");

  // Look up the subject's code for the email subject line.
  let subjectCode: string | null = null;
  if (m.subjectType === "quote") {
    const [q] = await db.select({ code: quotes.quoteCode }).from(quotes).where(eq(quotes.id, m.subjectId));
    subjectCode = q?.code ?? null;
  } else if (m.subjectType === "trip") {
    const [t] = await db.select({ code: trips.tripCode }).from(trips).where(eq(trips.id, m.subjectId));
    subjectCode = t?.code ?? null;
  }
  if (!subjectCode || (m.subjectType !== "quote" && m.subjectType !== "trip")) {
    return err("not_found", "SUBJECT_NOT_FOUND");
  }

  return ok({
    message: {
      id: m.id,
      subjectType: m.subjectType,
      subjectId: m.subjectId,
      channel: m.channel,
      toAddress: m.toAddress,
      body: m.body,
      preview: m.preview,
    },
    subjectCode,
  });
}

export type MessageRetryOutcome =
  | { status: "sent"; provider: string }
  | { status: "failed"; error: string };

/**
 * Re-send a failed thread message and record the new outcome on the row.
 * A successful retry leaves the message `sent` (or `queued` when the
 * channel is only logging); a still-failing retry updates the error text
 * but keeps `failed`, so nothing is ever double-delivered.
 */
export async function retryMessageDelivery(
  actor: Actor,
  _input: MessageRetryInput,
  state: MessageRetryState,
): Promise<Result<MessageRetryOutcome>> {
  const { message: m, subjectCode } = state;
  const a = auditFields(actor);

  const preview = m.preview ?? m.body.slice(0, 140);
  const summary = preview.length > 60 ? `${preview.slice(0, 59)}…` : preview;

  // Dynamic on purpose: the transports are `server-only` modules.
  const { dispatchThreadMessage } = await import("@/lib/message-delivery");
  const result = await dispatchThreadMessage(m.channel, {
    to: m.toAddress,
    subjectCode,
    subjectSummary: summary,
    body: m.body,
  });

  if (result.ok) {
    // Honest status: logger mode means nothing left the building.
    const logger = result.provider === "logger";
    await db
      .update(messages)
      .set({
        deliveryStatus: logger ? "queued" : "sent",
        deliveryProvider: result.provider,
        deliveryMessageId: result.messageId ?? null,
        deliveryError: logger ? "channel not configured — logged only, not delivered" : null,
        deliveredAt: logger ? null : new Date(),
      })
      .where(eq(messages.id, m.id));

    await logAudit({
      actorUserId: a.actorUserId,
      actorRole: a.actorRole,
      action: `${m.subjectType}.message.delivery.retry`,
      subjectType: m.subjectType,
      subjectId: m.subjectId,
      subjectCode,
      metadata: {
        ...a.metadata,
        messageId: m.id,
        outcome: "sent",
        provider: result.provider,
        providerMessageId: result.messageId ?? null,
      },
    });

    return ok({ status: "sent", provider: result.provider });
  }

  // Still failing: keep status='failed' but surface the new error.
  await db
    .update(messages)
    .set({ deliveryError: result.error.slice(0, 500) })
    .where(eq(messages.id, m.id));

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: `${m.subjectType}.message.delivery.retry`,
    subjectType: m.subjectType,
    subjectId: m.subjectId,
    subjectCode,
    metadata: { ...a.metadata, messageId: m.id, outcome: "failed", error: result.error },
  });

  return ok({ status: "failed", error: result.error });
}

// ─── Mark a thread read ──────────────────────────────────────────────────

export type MarkThreadReadState = {
  /** Inbound messages still unread on the thread when the op was loaded. */
  unread: number;
};

export async function loadThreadForMarkRead(input: MarkThreadReadInput): Promise<Result<MarkThreadReadState>> {
  if (!isUuid(input.id)) return err("not_found", "No thread with that id.");
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        eq(messages.subjectType, input.kind),
        eq(messages.subjectId, input.id),
        eq(messages.direction, "in"),
        eq(messages.isRead, false),
      ),
    );
  return ok({ unread: row?.n ?? 0 });
}

/**
 * Mark a thread's inbound messages read. `is_read` is written on every
 * inbound insert and read by the sidebar count and the Unread tab. A
 * thread with nothing unread (or no messages at all) is a no-op success.
 */
export async function markThreadRead(_actor: Actor, input: MarkThreadReadInput): Promise<Result<{ updated: number }>> {
  const updated = await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.subjectType, input.kind),
        eq(messages.subjectId, input.id),
        eq(messages.direction, "in"),
        eq(messages.isRead, false),
      ),
    )
    .returning({ id: messages.id });
  return ok({ updated: updated.length });
}

// ─── Website inquiries ───────────────────────────────────────────────────

export type InquiryStatusState = {
  inquiry: { id: string; status: "new" | "handled" };
};

export async function loadInquiryForStatus(input: InquiryStatusInput): Promise<Result<InquiryStatusState>> {
  if (!isUuid(input.id)) return err("not_found", "NOT_FOUND");
  const [inquiry] = await db
    .select({ id: contactInquiries.id, status: contactInquiries.status })
    .from(contactInquiries)
    .where(eq(contactInquiries.id, input.id));
  if (!inquiry) return err("not_found", "NOT_FOUND");
  return ok({ inquiry });
}

/**
 * Toggle an inquiry between new ↔ handled. Handled stamps who + when;
 * reopening clears both so the row reads honestly on the board.
 */
export async function setInquiryStatus(
  actor: Actor,
  input: InquiryStatusInput,
  state: InquiryStatusState,
): Promise<Result<{ id: string; status: "new" | "handled" }>> {
  const { inquiry } = state;
  const a = auditFields(actor);

  try {
    const [row] = await db
      .update(contactInquiries)
      .set(
        input.status === "handled"
          ? { status: "handled", handledByUserId: a.actorUserId, handledAt: new Date() }
          : { status: "new", handledByUserId: null, handledAt: null },
      )
      .where(eq(contactInquiries.id, inquiry.id))
      .returning({ id: contactInquiries.id });
    if (!row) return err("not_found", "NOT_FOUND");
  } catch (e) {
    console.error("setInquiryStatus failed", e);
    return err("internal", "DB_UPDATE_FAILED");
  }

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: `contact_inquiry.${input.status === "handled" ? "handle" : "reopen"}`,
    subjectType: "contact_inquiry",
    subjectId: inquiry.id,
    metadata: a.metadata,
  });

  return ok({ id: inquiry.id, status: input.status });
}
