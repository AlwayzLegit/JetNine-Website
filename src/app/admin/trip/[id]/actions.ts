"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs, tripStatusEnum } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import {
  reserveTransactions,
  type NewReserveTransaction,
} from "@/db/schema/memberships";
import {
  messageChannelEnum,
  messages,
  type NewMessage,
} from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  isNotifiableTripStatus,
  sendTripStatusEmail,
  type TripNotifyStatus,
} from "@/lib/email";
import { sendTripStatusSms } from "@/lib/twilio";
import { dispatchThreadMessage, type ThreadChannel } from "@/lib/message-delivery";

type Status = (typeof tripStatusEnum.enumValues)[number];

function isStatus(v: string): v is Status {
  return (tripStatusEnum.enumValues as readonly string[]).includes(v);
}

export async function updateTripStatus(
  tripId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireStaff();
  if (!isStatus(status)) return { ok: false, error: "Invalid status" };

  const [before] = await db
    .select({ status: trips.status, code: trips.tripCode })
    .from(trips)
    .where(eq(trips.id, tripId));

  const patch: Partial<typeof trips.$inferInsert> = { status };
  // Stamp wheels timestamps as a convenience when the dispatcher moves the
  // trip across the obvious milestones.
  const now = new Date();
  if (status === "airborne") patch.wheelsUpAt = now;
  if (status === "wheels_down" || status === "completed") patch.wheelsDownAt = now;

  await db.update(trips).set(patch).where(eq(trips.id, tripId));

  // Auto-refund: when a trip transitions into a cancelled state, look
  // for any charter_draw rows we inserted at conversion time and post
  // equal-and-opposite refund rows so the member's balance is made
  // whole. Triggered only on these two states — `diverted` and
  // `irregular_ops` mean the trip still happened (or partly happened)
  // so refund policy is ops-decided.
  let refund: { count: number; totalUsd: number } | null = null;
  if (
    (status === "cancelled_wx" || status === "cancelled_other") &&
    before?.status !== status
  ) {
    refund = await refundChartDrawsForTrip({
      tripId,
      reason: status,
      actorUserId: actor.id,
      tripCode: before?.code ?? null,
    });
  }

  // Customer-facing status notifications. Fire after the DB update so a
  // failed email never blocks the status change. The email itself is
  // logged as a message row on the trip thread (channel='email',
  // direction='out', fromUserId=actor) so it shows up in both the
  // workbench thread and — if delivery fails — the /admin/dispatch
  // failed-delivery panel for retry.
  let notification: { status: "sent" | "failed" | "skipped"; error?: string } = {
    status: "skipped",
  };
  if (
    isNotifiableTripStatus(status) &&
    before?.status !== status // only on actual transition, not idempotent flips
  ) {
    notification = await notifyTripStatus({
      tripId,
      tripCode: before?.code ?? null,
      newStatus: status,
      actorUserId: actor.id,
    });
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "trip.status.update",
    subjectType: "trip",
    subjectId: tripId,
    subjectCode: before?.code ?? null,
    diff: { status: { before: before?.status ?? null, after: status } },
    metadata: {
      wheelsUpAt: patch.wheelsUpAt?.toISOString() ?? null,
      wheelsDownAt: patch.wheelsDownAt?.toISOString() ?? null,
      notification,
      refund,
    },
  });

  revalidatePath("/admin/trip");
  revalidatePath(`/admin/trip/${tripId}`);
  revalidatePath("/admin/dispatch");
  revalidatePath("/account/trips");
  return { ok: true };
}

async function notifyTripStatus(args: {
  tripId: string;
  tripCode: string | null;
  newStatus: TripNotifyStatus;
  actorUserId: string;
}): Promise<{ status: "sent" | "failed" | "skipped"; error?: string }> {
  // Member + itinerary lookups are independent — parallelize. Saves
  // one DB round-trip on every status flip (~20-50 ms p50).
  const [targetRows, legs] = await Promise.all([
    db
      .select({
        memberUserId: members.userId,
        memberEmail: users.email,
        memberPhone: users.phoneE164,
        memberFirstName: users.firstName,
        paxCount: trips.paxCount,
      })
      .from(trips)
      .innerJoin(members, eq(members.id, trips.memberId))
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(trips.id, args.tripId)),
    db
      .select({
        fromIcao: tripLegs.fromIcao,
        toIcao: tripLegs.toIcao,
        departDate: tripLegs.departDate,
      })
      .from(tripLegs)
      .where(eq(tripLegs.tripId, args.tripId))
      .orderBy(asc(tripLegs.legNumber)),
  ]);
  const target = targetRows[0];

  if (!target || !args.tripCode) {
    return { status: "skipped" };
  }
  if (!target.memberEmail && !target.memberPhone) {
    return { status: "skipped" };
  }

  const itineraryLines = legs
    .slice(0, 4) // cap to 4 lines so the email stays scannable
    .map((l) => {
      const route = `${l.fromIcao ?? "—"} → ${l.toIcao ?? "—"}`;
      const date = l.departDate ? String(l.departDate) : "—";
      return `${route} · ${date}`;
    });
  if (target.paxCount) {
    itineraryLines.push(`${target.paxCount} pax`);
  }

  // Stub a message row in the thread BEFORE sending so the operator
  // sees a `queued` pill immediately on revalidate. Then update with
  // the delivery outcome.
  const body =
    `Auto-generated status notification: ${args.newStatus}. ` +
    `See email content for member-facing copy.`;
  const previewBody = `Status → ${args.newStatus}`;

  // Email + SMS in parallel for real this time — each independently
  // logged in messages so delivery failures of one don't lose the
  // other. Saves ~300-800 ms p50 vs the previous sequential awaits.
  const [emailOutcome, smsOutcome] = await Promise.all([
    target.memberEmail
      ? fireChannel({
          channel: "email",
          toAddress: target.memberEmail,
          send: () =>
            sendTripStatusEmail({
              to: target.memberEmail!,
              tripCode: args.tripCode!,
              status: args.newStatus,
              firstName: target.memberFirstName,
              itineraryLines,
            }),
          previewBody,
          body,
          tripId: args.tripId,
          memberUserId: target.memberUserId,
          actorUserId: args.actorUserId,
        })
      : Promise.resolve({ status: "skipped" as const }),
    target.memberPhone
      ? fireChannel({
          channel: "sms",
          toAddress: target.memberPhone,
          send: () =>
            sendTripStatusSms({
              to: target.memberPhone!,
              tripCode: args.tripCode!,
              status: args.newStatus,
              firstLeg: itineraryLines[0] ?? null,
            }),
          previewBody,
          body,
          tripId: args.tripId,
          memberUserId: target.memberUserId,
          actorUserId: args.actorUserId,
        })
      : Promise.resolve({ status: "skipped" as const }),
  ]);

  // Treat 'sent' on either channel as overall success for audit
  // purposes. The per-channel detail is in the messages rows.
  if (emailOutcome.status === "sent" || smsOutcome.status === "sent") {
    return { status: "sent" };
  }
  if (emailOutcome.status === "failed" || smsOutcome.status === "failed") {
    return {
      status: "failed",
      error:
        emailOutcome.status === "failed"
          ? emailOutcome.error
          : (smsOutcome as { error?: string }).error,
    };
  }
  return { status: "skipped" };
}

type FireResult = { status: "sent" } | { status: "failed"; error?: string };

async function fireChannel(args: {
  channel: "email" | "sms";
  toAddress: string;
  send: () => Promise<{ ok: true; provider: string; messageId?: string } | { ok: false; error: string }>;
  previewBody: string;
  body: string;
  tripId: string;
  memberUserId: string;
  actorUserId: string;
}): Promise<FireResult> {
  const values: NewMessage = {
    subjectType: "trip",
    subjectId: args.tripId,
    channel: args.channel,
    direction: "out",
    fromAddress: null,
    toAddress: args.toAddress,
    fromUserId: args.actorUserId,
    toUserId: args.memberUserId,
    preview: args.previewBody,
    body: args.body,
    isRead: false,
    deliveryStatus: "queued",
  };

  let messageId: string;
  try {
    const [row] = await db.insert(messages).values(values).returning({ id: messages.id });
    messageId = row.id;
  } catch (err) {
    console.error(`[trip-status:${args.channel}] message insert failed`, err);
    return { status: "failed", error: "DB_INSERT_FAILED" };
  }

  const result = await args.send();

  if (result.ok) {
    await db
      .update(messages)
      .set({
        deliveryStatus: "sent",
        deliveryProvider: result.provider,
        deliveryMessageId: result.messageId ?? null,
        deliveredAt: new Date(),
      })
      .where(eq(messages.id, messageId));
    return { status: "sent" };
  }

  await db
    .update(messages)
    .set({
      deliveryStatus: "failed",
      deliveryError: result.error.slice(0, 500),
    })
    .where(eq(messages.id, messageId));
  return { status: "failed", error: result.error };
}

// ─── Messaging thread (subject_type='trip') ──────────────────────────────

type Channel = (typeof messageChannelEnum.enumValues)[number];

const ALLOWED_DISPATCHER_CHANNELS: readonly Channel[] = [
  "inapp",
  "email",
  "sms",
  "call",
  "voicemail",
] as const;

function isAllowedChannel(v: string): v is Channel {
  return (ALLOWED_DISPATCHER_CHANNELS as readonly string[]).includes(v);
}

export type PostTripMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function postTripMessage(
  tripId: string,
  formData: FormData,
): Promise<PostTripMessageResult> {
  const actor = await requireStaff();

  if (!/^[0-9a-f-]{36}$/i.test(tripId)) {
    return { ok: false, error: "Bad trip id" };
  }

  const channelRaw = ((formData.get("channel") as string | null) ?? "").trim();
  if (!isAllowedChannel(channelRaw)) return { ok: false, error: "Pick a channel" };

  const body = ((formData.get("body") as string | null) ?? "").trim();
  if (body.length < 1) return { ok: false, error: "Body required" };
  if (body.length > 4000) return { ok: false, error: "Body too long (4000 max)" };

  const toAddress = ((formData.get("toAddress") as string | null) ?? "").trim() || null;

  // Look up the trip + its member's contact info for default to-address.
  const [t] = await db
    .select({
      id: trips.id,
      code: trips.tripCode,
      memberId: trips.memberId,
      memberUserId: members.userId,
      memberEmail: users.email,
      memberPhone: users.phoneE164,
    })
    .from(trips)
    .innerJoin(members, eq(members.id, trips.memberId))
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(trips.id, tripId));
  if (!t) return { ok: false, error: "Trip not found" };

  const defaultTo =
    channelRaw === "email"
      ? t.memberEmail
      : channelRaw === "sms" || channelRaw === "call" || channelRaw === "voicemail"
        ? t.memberPhone
        : null;

  const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;
  const finalTo = toAddress ?? defaultTo;

  // SMS + WhatsApp now transmit via Twilio in addition to email. Other
  // channels (inapp, call, voicemail) remain logged-only dispatcher notes.
  const willTransmit =
    (channelRaw === "email" || channelRaw === "sms" || channelRaw === "whatsapp") &&
    Boolean(finalTo);
  const initialStatus: "queued" | "skipped" = willTransmit ? "queued" : "skipped";

  const values: NewMessage = {
    subjectType: "trip",
    subjectId: tripId,
    channel: channelRaw,
    direction: "out",
    fromAddress: null,
    toAddress: finalTo,
    fromUserId: actor.id,
    toUserId: t.memberUserId,
    preview,
    body,
    isRead: false,
    deliveryStatus: initialStatus,
  };

  let messageId: string;
  try {
    const [row] = await db
      .insert(messages)
      .values(values)
      .returning({ id: messages.id });
    messageId = row.id;
  } catch (err) {
    console.error("postTripMessage insert failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }

  let deliveryAudit: Record<string, unknown> = { status: initialStatus };
  if (willTransmit && finalTo) {
    const summary = preview.length > 60 ? `${preview.slice(0, 59)}…` : preview;
    const result = await dispatchThreadMessage(channelRaw as ThreadChannel, {
      to: finalTo,
      subjectCode: t.code,
      subjectSummary: summary,
      body,
    });
    if (result.ok) {
      await db
        .update(messages)
        .set({
          deliveryStatus: "sent",
          deliveryProvider: result.provider,
          deliveryMessageId: result.messageId ?? null,
          deliveredAt: new Date(),
        })
        .where(eq(messages.id, messageId));
      deliveryAudit = {
        status: "sent",
        provider: result.provider,
        messageId: result.messageId ?? null,
      };
    } else {
      await db
        .update(messages)
        .set({
          deliveryStatus: "failed",
          deliveryError: result.error.slice(0, 500),
        })
        .where(eq(messages.id, messageId));
      deliveryAudit = { status: "failed", error: result.error };
    }
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "trip.message.post",
    subjectType: "trip",
    subjectId: tripId,
    subjectCode: t.code,
    metadata: {
      messageId,
      channel: channelRaw,
      toAddress: finalTo,
      bodyLen: body.length,
      delivery: deliveryAudit,
    },
  });

  revalidatePath(`/admin/trip/${tripId}`);
  return { ok: true, id: messageId };
}

/**
 * On a cancelled-trip transition, post equal-and-opposite refund rows
 * to the reserve ledger for every prior charter_draw against this
 * trip. Marks the linked invoice(s) as 'void' so /account/invoices and
 * /admin reports don't keep counting them as paid revenue.
 *
 * Policy: full refund of the drawn amount. Partial-keep / penalty
 * scenarios (member-initiated late cancel, etc.) need an ops-side
 * manual adjustment row on top — this baseline just unwinds the
 * automatic draw so the member's balance reflects the trip not
 * happening.
 *
 * Returns null when no draws existed (nothing to refund).
 */
async function refundChartDrawsForTrip(args: {
  tripId: string;
  reason: "cancelled_wx" | "cancelled_other";
  actorUserId: string;
  tripCode: string | null;
}): Promise<{ count: number; totalUsd: number } | null> {
  const draws = await db
    .select({
      id: reserveTransactions.id,
      memberId: reserveTransactions.memberId,
      membershipId: reserveTransactions.membershipId,
      amountUsd: reserveTransactions.amountUsd,
      invoiceId: reserveTransactions.invoiceId,
    })
    .from(reserveTransactions)
    .where(
      and(
        eq(reserveTransactions.tripId, args.tripId),
        eq(reserveTransactions.kind, "charter_draw"),
      ),
    );

  if (draws.length === 0) return null;

  let totalUsd = 0;
  await db.transaction(async (tx) => {
    for (const d of draws) {
      // charter_draws are stored as negative amounts; refund is the
      // signed opposite (positive) so balance returns to pre-flight.
      const refundAmount = -d.amountUsd;
      const refundRow: NewReserveTransaction = {
        memberId: d.memberId,
        membershipId: d.membershipId,
        kind: "refund",
        amountUsd: refundAmount,
        description: `Refund — trip ${args.tripCode ?? args.tripId.slice(0, 8)} (${args.reason})`,
        tripId: args.tripId,
        invoiceId: d.invoiceId,
      };
      await tx.insert(reserveTransactions).values(refundRow);
      totalUsd += refundAmount;

      if (d.invoiceId) {
        await tx
          .update(invoices)
          .set({ status: "void", notes: undefined, updatedAt: new Date() })
          .where(eq(invoices.id, d.invoiceId));
      }
    }
  });

  await logAudit({
    actorUserId: args.actorUserId,
    actorRole: "system",
    action: "trip.cancel.refund",
    subjectType: "trip",
    subjectId: args.tripId,
    subjectCode: args.tripCode,
    metadata: {
      reason: args.reason,
      refundCount: draws.length,
      totalRefundedUsd: totalUsd,
      reserveTxIds: draws.map((d) => d.id),
    },
  });

  return { count: draws.length, totalUsd };
}
