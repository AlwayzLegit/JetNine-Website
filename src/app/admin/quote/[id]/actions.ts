"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs, quoteStatusEnum } from "@/db/schema/quotes";
import { trips, tripLegs, type NewTrip, type NewTripLeg } from "@/db/schema/trips";
import { invoices, type NewInvoice } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { staff } from "@/db/schema/staff";
import {
  messageChannelEnum,
  messages,
  type NewMessage,
} from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Status = (typeof quoteStatusEnum.enumValues)[number];

function isStatus(v: string): v is Status {
  return (quoteStatusEnum.enumValues as readonly string[]).includes(v);
}

export async function updateQuoteStatus(
  quoteId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireStaff();
  if (!isStatus(status)) return { ok: false, error: "Invalid status" };

  const [before] = await db
    .select({ status: quotes.status, code: quotes.quoteCode })
    .from(quotes)
    .where(eq(quotes.id, quoteId));

  await db
    .update(quotes)
    .set({ status, respondedAt: respondedAtPatch(status) })
    .where(eq(quotes.id, quoteId));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.status.update",
    subjectType: "quote",
    subjectId: quoteId,
    subjectCode: before?.code ?? null,
    diff: { status: { before: before?.status ?? null, after: status } },
  });

  revalidatePath("/admin/dispatch");
  revalidatePath(`/admin/quote/${quoteId}`);
  return { ok: true };
}

function respondedAtPatch(status: Status): Date | undefined {
  // First time we hit options_sent or held, stamp responded_at.
  if (status === "options_sent" || status === "held") return new Date();
  return undefined;
}

export async function assignDispatcher(
  quoteId: string,
  staffId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireStaff();

  if (staffId) {
    const [exists] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.id, staffId));
    if (!exists) return { ok: false, error: "Unknown dispatcher" };
  }

  const [before] = await db
    .select({
      assignedDispatcherId: quotes.assignedDispatcherId,
      code: quotes.quoteCode,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId));

  await db
    .update(quotes)
    .set({ assignedDispatcherId: staffId })
    .where(eq(quotes.id, quoteId));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.dispatcher.assign",
    subjectType: "quote",
    subjectId: quoteId,
    subjectCode: before?.code ?? null,
    diff: {
      assignedDispatcherId: { before: before?.assignedDispatcherId ?? null, after: staffId },
    },
  });

  revalidatePath("/admin/dispatch");
  revalidatePath(`/admin/quote/${quoteId}`);
  return { ok: true };
}

// ─── convertQuoteToTrip ──────────────────────────────────────────────────
// Promotes an accepted quote into a real trip + a draft invoice. Idempotent
// against the quote (won't double-convert if already linked).

const SEGMENT_FEE_USD = 5.2; // IRS 2026 rate

export async function convertQuoteToTrip(
  quoteId: string,
): Promise<{ ok: true; tripId: string; tripCode: string; invoiceId: string } | { ok: false; error: string }> {
  const actor = await requireStaff();

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!quote) return { ok: false, error: "Quote not found" };
  if (quote.convertedTripId) {
    return { ok: false, error: `Already converted to ${quote.convertedTripId}` };
  }
  if (quote.status === "cancelled" || quote.status === "expired" || quote.status === "declined") {
    return { ok: false, error: `Quote is ${quote.status}` };
  }

  // Resolve member: prefer an existing member row by email. Auto-creating
  // a member here requires a Supabase auth user — kept out of scope.
  let memberId = quote.memberId;
  if (!memberId) {
    const email = quote.contactSnapshot?.email?.toLowerCase()?.trim();
    if (email) {
      const [hit] = await db
        .select({ id: members.id })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(users.email, email));
      memberId = hit?.id ?? null;
    }
  }
  if (!memberId) {
    return {
      ok: false,
      error: "No member row for this contact — create the member account first.",
    };
  }

  const legs = await db
    .select()
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, quoteId))
    .orderBy(asc(quoteLegs.legNumber));
  if (legs.length === 0) return { ok: false, error: "Quote has no legs" };

  // Pricing — derive a subtotal from the indicative midpoint until the
  // dispatcher fills in real numbers from the operator.
  const subtotal =
    quote.indicativeLowUsd && quote.indicativeHighUsd
      ? Math.round((quote.indicativeLowUsd + quote.indicativeHighUsd) / 2)
      : null;
  const fet = subtotal ? Math.round(subtotal * 0.075) : null;
  const seg = Math.round(SEGMENT_FEE_USD * quote.paxCount * legs.length);
  const total = subtotal !== null ? subtotal + (fet ?? 0) + seg : null;

  const inserted = await db.transaction(async (tx) => {
    const tripValues: NewTrip = {
      memberId,
      quoteId,
      assignedDispatcherId: quote.assignedDispatcherId ?? null,
      missionType:
        quote.tripType === "round"
          ? "round"
          : quote.tripType === "one_way"
            ? "one_way"
            : "multi_leg",
      paxCount: quote.paxCount,
      crewCount: 2,
      isInternational: legs.some(
        (l) =>
          (l.fromIcao && !l.fromIcao.startsWith("K")) ||
          (l.toIcao && !l.toIcao.startsWith("K")),
      ),
      status: "confirmed",
      revenueUsd: subtotal,
    };
    const [tripRow] = await tx
      .insert(trips)
      .values(tripValues)
      .returning({ id: trips.id, tripCode: trips.tripCode });

    const tripLegRows: NewTripLeg[] = legs.map((l) => ({
      tripId: tripRow.id,
      legNumber: l.legNumber,
      fromIcao: l.fromIcao,
      fromIata: l.fromIata,
      fromCity: l.fromCity,
      fromName: l.fromName,
      toIcao: l.toIcao,
      toIata: l.toIata,
      toCity: l.toCity,
      toName: l.toName,
      departDate: l.departDate,
      departTime: l.departTime,
      departTz: l.departTz,
      distanceNm: l.distanceNm,
    }));
    await tx.insert(tripLegs).values(tripLegRows);

    const invoiceValues: NewInvoice = {
      memberId,
      tripId: tripRow.id,
      kind: "charter",
      status: "draft",
      subtotalUsd: subtotal,
      fetUsd: fet,
      segmentFeeUsd: seg,
      totalUsd: total,
    };
    const [invRow] = await tx
      .insert(invoices)
      .values(invoiceValues)
      .returning({ id: invoices.id });

    await tx
      .update(quotes)
      .set({
        status: "converted",
        acceptedAt: new Date(),
        convertedTripId: tripRow.id,
      })
      .where(eq(quotes.id, quoteId));

    return { trip: tripRow, invoice: invRow };
  });

  revalidatePath("/admin/dispatch");
  revalidatePath(`/admin/quote/${quoteId}`);
  revalidatePath("/admin/trip");
  revalidatePath("/account/trips");
  revalidatePath("/account/invoices");

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.convert.trip",
    subjectType: "quote",
    subjectId: quoteId,
    subjectCode: quote.quoteCode,
    diff: {
      status: { before: quote.status, after: "converted" },
      convertedTripId: { before: null, after: inserted.trip.id },
    },
    metadata: {
      tripCode: inserted.trip.tripCode,
      invoiceId: inserted.invoice.id,
      memberId,
      subtotalUsd: subtotal,
      fetUsd: fet,
      segmentFeeUsd: seg,
      totalUsd: total,
    },
  });
  // Also log on the trip subject so trip-scoped queries see the conversion.
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "trip.create.from_quote",
    subjectType: "trip",
    subjectId: inserted.trip.id,
    subjectCode: inserted.trip.tripCode,
    metadata: { quoteId, quoteCode: quote.quoteCode },
  });

  return {
    ok: true,
    tripId: inserted.trip.id,
    tripCode: inserted.trip.tripCode,
    invoiceId: inserted.invoice.id,
  };
}

// ─── Messaging thread ────────────────────────────────────────────────────────
// Posts a dispatcher-authored message on a quote thread. Direction is always
// "out" — inbound messages arrive via webhook (Twilio / Postmark) which is
// not wired yet. Channel "system" is reserved for status-change auto-notes.

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

export type PostQuoteMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function postQuoteMessage(
  quoteId: string,
  formData: FormData,
): Promise<PostQuoteMessageResult> {
  const actor = await requireStaff();

  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) {
    return { ok: false, error: "Bad quote id" };
  }

  const channelRaw = ((formData.get("channel") as string | null) ?? "").trim();
  if (!isAllowedChannel(channelRaw)) {
    return { ok: false, error: "Pick a channel" };
  }

  const body = ((formData.get("body") as string | null) ?? "").trim();
  if (body.length < 1) return { ok: false, error: "Body required" };
  if (body.length > 4000) return { ok: false, error: "Body too long (4000 max)" };

  const toAddress = ((formData.get("toAddress") as string | null) ?? "").trim() || null;

  // Confirm the quote exists + grab the contact snapshot for default to-address.
  const [q] = await db
    .select({
      id: quotes.id,
      code: quotes.quoteCode,
      memberId: quotes.memberId,
      contactSnapshot: quotes.contactSnapshot,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId));
  if (!q) return { ok: false, error: "Quote not found" };

  // Default to-address per channel: email → contact.email; sms/call/voicemail → contact phone.
  const defaultTo =
    channelRaw === "email"
      ? q.contactSnapshot?.email ?? null
      : channelRaw === "sms" || channelRaw === "call" || channelRaw === "voicemail"
        ? q.contactSnapshot?.phoneE164
          ? `${q.contactSnapshot.phoneCountry ?? ""}${q.contactSnapshot.phoneE164}`
          : null
        : null;

  // Map member.user_id → toUserId so the member's inbox query joins cleanly.
  let toUserId: string | null = null;
  if (q.memberId) {
    const [m] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(eq(members.id, q.memberId));
    toUserId = m?.userId ?? null;
  }

  const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;

  const values: NewMessage = {
    subjectType: "quote",
    subjectId: quoteId,
    channel: channelRaw,
    direction: "out",
    fromAddress: null,
    toAddress: toAddress ?? defaultTo,
    fromUserId: actor.id,
    toUserId,
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
      action: "quote.message.post",
      subjectType: "quote",
      subjectId: quoteId,
      subjectCode: q.code,
      metadata: {
        messageId: row.id,
        channel: channelRaw,
        toAddress: values.toAddress,
        bodyLen: body.length,
      },
    });

    revalidatePath(`/admin/quote/${quoteId}`);
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("postQuoteMessage failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}
