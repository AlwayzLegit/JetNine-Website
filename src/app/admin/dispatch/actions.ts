"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendThreadMessageEmail } from "@/lib/email";
import { sendThreadMessageSms, sendThreadMessageWhatsApp } from "@/lib/twilio";

export type RetryResult =
  | { ok: true; status: "sent" | "failed"; provider?: string; error?: string }
  | { ok: false; error: string };

/**
 * Retry a failed thread-message delivery. Looks up the message row, the
 * subject's entity code, then re-calls sendThreadMessageEmail and
 * updates the row with the new outcome. Idempotent in the sense that
 * a successful retry leaves the message in `sent`; a still-failing
 * retry updates the error text but doesn't double-deliver.
 */
export async function retryMessageDelivery(messageId: string): Promise<RetryResult> {
  const actor = await requireStaff();

  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return { ok: false, error: "INVALID_ID" };
  }

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
    .where(eq(messages.id, messageId));

  if (!m) return { ok: false, error: "NOT_FOUND" };
  if (m.direction !== "out") return { ok: false, error: "NOT_OUTBOUND" };
  if (m.channel !== "email" && m.channel !== "sms" && m.channel !== "whatsapp") {
    return { ok: false, error: "ONLY_EMAIL_SMS_OR_WHATSAPP" };
  }
  if (!m.toAddress) return { ok: false, error: "NO_RECIPIENT" };
  if (!m.body) return { ok: false, error: "NO_BODY" };
  if (m.deliveryStatus !== "failed") {
    return { ok: false, error: "NOT_FAILED" };
  }

  // Look up the subject's code for the email subject line.
  let subjectCode: string | null = null;
  if (m.subjectType === "quote") {
    const [q] = await db
      .select({ code: quotes.quoteCode })
      .from(quotes)
      .where(eq(quotes.id, m.subjectId));
    subjectCode = q?.code ?? null;
  } else if (m.subjectType === "trip") {
    const [t] = await db
      .select({ code: trips.tripCode })
      .from(trips)
      .where(eq(trips.id, m.subjectId));
    subjectCode = t?.code ?? null;
  }
  if (!subjectCode) return { ok: false, error: "SUBJECT_NOT_FOUND" };

  const preview = m.preview ?? m.body.slice(0, 140);
  const summary = preview.length > 60 ? `${preview.slice(0, 59)}…` : preview;

  const result =
    m.channel === "email"
      ? await sendThreadMessageEmail({
          to: m.toAddress,
          subjectCode,
          subjectSummary: summary,
          body: m.body,
        })
      : m.channel === "whatsapp"
        ? await sendThreadMessageWhatsApp({
            to: m.toAddress,
            subjectCode,
            body: m.body,
          })
        : await sendThreadMessageSms({
            to: m.toAddress,
            subjectCode,
            body: m.body,
          });

  if (result.ok) {
    await db
      .update(messages)
      .set({
        deliveryStatus: "sent",
        deliveryProvider: result.provider,
        deliveryMessageId: result.messageId ?? null,
        deliveryError: null,
        deliveredAt: new Date(),
      })
      .where(eq(messages.id, m.id));

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: `${m.subjectType}.message.delivery.retry`,
      subjectType: m.subjectType,
      subjectId: m.subjectId,
      subjectCode,
      metadata: {
        messageId: m.id,
        outcome: "sent",
        provider: result.provider,
        providerMessageId: result.messageId ?? null,
      },
    });

    revalidatePath("/admin/dispatch");
    revalidatePath(`/admin/${m.subjectType}/${m.subjectId}`);
    return { ok: true, status: "sent", provider: result.provider };
  }

  // Still failing. Update the error and revalidate so the new error
  // surfaces in the UI, but keep status='failed'.
  await db
    .update(messages)
    .set({
      deliveryError: result.error.slice(0, 500),
    })
    .where(eq(messages.id, m.id));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: `${m.subjectType}.message.delivery.retry`,
    subjectType: m.subjectType,
    subjectId: m.subjectId,
    subjectCode,
    metadata: {
      messageId: m.id,
      outcome: "failed",
      error: result.error,
    },
  });

  revalidatePath("/admin/dispatch");
  return { ok: true, status: "failed", error: result.error };
}
