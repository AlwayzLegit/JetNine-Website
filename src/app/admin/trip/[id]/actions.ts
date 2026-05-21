"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripStatusEnum } from "@/db/schema/trips";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import {
  messageChannelEnum,
  messages,
  type NewMessage,
} from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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
    },
  });

  revalidatePath("/admin/trip");
  revalidatePath(`/admin/trip/${tripId}`);
  revalidatePath("/account/trips");
  return { ok: true };
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

  const values: NewMessage = {
    subjectType: "trip",
    subjectId: tripId,
    channel: channelRaw,
    direction: "out",
    fromAddress: null,
    toAddress: toAddress ?? defaultTo,
    fromUserId: actor.id,
    toUserId: t.memberUserId,
    preview,
    body,
    isRead: false,
  };

  try {
    const [row] = await db
      .insert(messages)
      .values(values)
      .returning({ id: messages.id });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "trip.message.post",
      subjectType: "trip",
      subjectId: tripId,
      subjectCode: t.code,
      metadata: {
        messageId: row.id,
        channel: channelRaw,
        toAddress: values.toAddress,
        bodyLen: body.length,
      },
    });

    revalidatePath(`/admin/trip/${tripId}`);
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("postTripMessage failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}
