"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs, tripStatusEnum } from "@/db/schema/trips";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import {
  messageChannelEnum,
  messages,
  type NewMessage,
} from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  isNotifiableTripStatus,
  sendThreadMessageEmail,
  sendTripStatusEmail,
  type TripNotifyStatus,
} from "@/lib/email";
import { sendThreadMessageSms, sendTripStatusSms } from "@/lib/twilio";

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
  // Look up member email + phone + first name + paxCount.
  const [target] = await db
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
    .where(eq(trips.id, args.tripId));

  if (!target || !args.tripCode) {
    return { status: "skipped" };
  }
  if (!target.memberEmail && !target.memberPhone) {
    return { status: "skipped" };
  }

  // Build a compact itinerary line per leg ("KLAX → KSFO · 2026-06-12").
  const legs = await db
    .select({
      fromIcao: tripLegs.fromIcao,
      toIcao: tripLegs.toIcao,
      departDate: tripLegs.departDate,
    })
    .from(tripLegs)
    .where(eq(tripLegs.tripId, args.tripId))
    .orderBy(asc(tripLegs.legNumber));

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

  // Email + SMS in parallel — each independently logged in messages so
  // delivery failures of one don't lose the other.
  const emailOutcome = target.memberEmail
    ? await fireChannel({
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
    : { status: "skipped" as const };

  const smsOutcome = target.memberPhone
    ? await fireChannel({
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
    : { status: "skipped" as const };

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

// ─── Messaging thread (subject_type='trip') ──────────────────────────────────

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

  // SMS now transmits via Twilio in addition to email. Other channels
  // (inapp, call, voicemail) remain logged-only dispatcher notes.
  const willTransmit =
    (channelRaw === "email" || channelRaw === "sms") && Boolean(finalTo);
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
    const result =
      channelRaw === "email"
        ? await sendThreadMessageEmail({
            to: finalTo,
            subjectCode: t.code,
            subjectSummary: summary,
            body,
          })
        : await sendThreadMessageSms({
            to: finalTo,
            subjectCode: t.code,
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
