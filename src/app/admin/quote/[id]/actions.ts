"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs, quoteStatusEnum } from "@/db/schema/quotes";
import { trips, tripLegs, type NewTrip, type NewTripLeg } from "@/db/schema/trips";
import { invoices, type NewInvoice } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { staff } from "@/db/schema/staff";
import { aircraft } from "@/db/schema/aircraft";
import {
  aircraftScheduleBlocks,
  type NewAircraftScheduleBlock,
} from "@/db/schema/schedule-blocks";
import {
  messageChannelEnum,
  messages,
  type NewMessage,
} from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { attemptInvoiceDrawdown, type DrawdownOutcome } from "@/lib/membership-balance";
import { dispatchThreadMessage, type ThreadChannel } from "@/lib/message-delivery";

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

// ─── convertQuoteToTrip ───────────────────────────────────────────
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

    // If the member has an active Card / Reserve with sufficient balance,
    // the invoice opens as 'due' so attemptInvoiceDrawdown can immediately
    // flip it to 'paid' from the reserve. Otherwise it stays 'draft' for
    // the dispatcher to review + finalize manually (current default).
    const memberHasCardBalance = total !== null && total > 0;
    const invoiceValues: NewInvoice = {
      memberId,
      tripId: tripRow.id,
      kind: "charter",
      // 'due' lets the drawdown helper short-circuit to 'paid' atomically.
      // If the draw fails (no card or insufficient balance), we revert to
      // 'draft' below so the existing review-then-finalize workflow holds.
      status: memberHasCardBalance ? "due" : "draft",
      subtotalUsd: subtotal,
      fetUsd: fet,
      segmentFeeUsd: seg,
      totalUsd: total,
    };
    const [invRow] = await tx
      .insert(invoices)
      .values(invoiceValues)
      .returning({ id: invoices.id });

    // Atomic drawdown: if the member has a Card/Reserve with balance
    // covering the full total, draw it down and flip the invoice to
    // 'paid' inside this same transaction.
    let drawdown: DrawdownOutcome | null = null;
    if (memberHasCardBalance) {
      drawdown = await attemptInvoiceDrawdown(tx, {
        invoiceId: invRow.id,
        memberId,
        tripId: tripRow.id,
        totalUsd: total,
      });
      // Drawdown didn't fire — revert the optimistic 'due' status to
      // 'draft' so it doesn't accidentally route the customer to Stripe
      // for an invoice the dispatcher meant to review first.
      if (!drawdown.drew) {
        await tx
          .update(invoices)
          .set({ status: "draft", updatedAt: new Date() })
          .where(eq(invoices.id, invRow.id));
      }
    }

    await tx
      .update(quotes)
      .set({
        status: "converted",
        acceptedAt: new Date(),
        convertedTripId: tripRow.id,
      })
      .where(eq(quotes.id, quoteId));

    return { trip: tripRow, invoice: invRow, drawdown };
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
      drawdown: inserted.drawdown,
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

  // Separate audit row for the membership drawdown so the membership
  // subject_type history reads as a clean ledger: top-ups + draws +
  // adjustments only.
  if (inserted.drawdown?.drew) {
    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "membership.charter_draw",
      subjectType: "membership",
      subjectId: null, // membershipId — we don't have it in scope here without an extra query
      metadata: {
        invoiceId: inserted.invoice.id,
        tripId: inserted.trip.id,
        tripCode: inserted.trip.tripCode,
        amountUsd: inserted.drawdown.amountUsd,
        reserveTxId: inserted.drawdown.reserveTxId,
        remainingBalanceUsd: inserted.drawdown.remainingBalanceUsd,
      },
    });
  }

  return {
    ok: true,
    tripId: inserted.trip.id,
    tripCode: inserted.trip.tripCode,
    invoiceId: inserted.invoice.id,
  };
}

// ─── Messaging thread ───────────────────────────────────────────────
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
  const finalTo = toAddress ?? defaultTo;

  // Email + SMS + WhatsApp all transmit. The others (inapp, call,
  // voicemail) remain dispatcher-side records of out-of-band contact;
  // marked 'skipped' on insert.
  const willTransmit =
    (channelRaw === "email" || channelRaw === "sms" || channelRaw === "whatsapp") &&
    Boolean(finalTo);
  const initialStatus: "queued" | "skipped" = willTransmit ? "queued" : "skipped";

  const values: NewMessage = {
    subjectType: "quote",
    subjectId: quoteId,
    channel: channelRaw,
    direction: "out",
    fromAddress: null,
    toAddress: finalTo,
    fromUserId: actor.id,
    toUserId,
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
    console.error("postQuoteMessage insert failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }

  // Best-effort transmission. We always log the audit row regardless of
  // delivery outcome — the DB record is the source of truth; delivery
  // status is a sidecar visible in the thread UI.
  let deliveryAudit: Record<string, unknown> = { status: initialStatus };
  if (willTransmit && finalTo) {
    const summary = preview.length > 60 ? `${preview.slice(0, 59)}…` : preview;
    const result = await dispatchThreadMessage(channelRaw as ThreadChannel, {
      to: finalTo,
      subjectCode: q.code,
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
    action: "quote.message.post",
    subjectType: "quote",
    subjectId: quoteId,
    subjectCode: q.code,
    metadata: {
      messageId,
      channel: channelRaw,
      toAddress: finalTo,
      bodyLen: body.length,
      delivery: deliveryAudit,
    },
  });

  revalidatePath(`/admin/quote/${quoteId}`);
  return { ok: true, id: messageId };
}

// ─── Soft holds ───────────────────────────────────────────────────────
// A soft hold puts a `kind='hold'` row on aircraft_schedule_blocks linked back
// to this quote. Different dispatchers can hold the same airframe for
// different quotes; conflict resolution is human until one is promoted to
// a confirmed trip. The hold window is derived from the quote's legs:
// earliest depart → latest depart + a 4-hour buffer for flight + ground.

const UUID_RE = /^[0-9a-f-]{36}$/i;
const DEFAULT_HOLD_BUFFER_HOURS = 4;

export type CreateSoftHoldResult =
  | { ok: true; blockId: string; expiresAt: string }
  | { ok: false; error: string };

export async function createSoftHold(
  quoteId: string,
  aircraftId: string,
): Promise<CreateSoftHoldResult> {
  const actor = await requireStaff();

  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (!UUID_RE.test(aircraftId)) return { ok: false, error: "Bad aircraft id" };

  const [q] = await db
    .select({ id: quotes.id, code: quotes.quoteCode, status: quotes.status })
    .from(quotes)
    .where(eq(quotes.id, quoteId));
  if (!q) return { ok: false, error: "Quote not found" };
  if (["accepted", "declined", "expired", "cancelled", "converted"].includes(q.status)) {
    return { ok: false, error: `Quote is ${q.status} — can't soft-hold` };
  }

  const [ac] = await db
    .select({ id: aircraft.id, tailNumber: aircraft.tailNumber, status: aircraft.status })
    .from(aircraft)
    .where(eq(aircraft.id, aircraftId));
  if (!ac) return { ok: false, error: "Aircraft not found" };
  if (ac.status === "sold") return { ok: false, error: "Aircraft is sold" };

  // Derive window from quote legs.
  const legs = await db
    .select({
      departDate: quoteLegs.departDate,
      departTime: quoteLegs.departTime,
    })
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, quoteId))
    .orderBy(asc(quoteLegs.departDate), asc(quoteLegs.departTime));
  if (legs.length === 0) return { ok: false, error: "Quote has no legs" };

  function legAt(d: string | null, t: string | null): Date | null {
    if (!d) return null;
    const time = t || "00:00";
    // Treat the value as UTC — there's no per-leg tz on the soft-hold path.
    const iso = `${d}T${time.length === 5 ? `${time}:00` : time}Z`;
    const dd = new Date(iso);
    return Number.isNaN(dd.getTime()) ? null : dd;
  }

  const startAt = legAt(legs[0].departDate, legs[0].departTime);
  const lastLegStart = legAt(legs[legs.length - 1].departDate, legs[legs.length - 1].departTime);
  if (!startAt || !lastLegStart) return { ok: false, error: "Quote legs lack a usable date" };

  const endAt = new Date(
    lastLegStart.getTime() + DEFAULT_HOLD_BUFFER_HOURS * 60 * 60 * 1000,
  );
  if (endAt <= startAt) {
    return { ok: false, error: "Computed hold window is degenerate" };
  }

  // Reject if THIS quote already holds THIS airframe — soft holds are
  // idempotent against (quote, aircraft).
  const [dup] = await db
    .select({ id: aircraftScheduleBlocks.id })
    .from(aircraftScheduleBlocks)
    .where(
      and(
        eq(aircraftScheduleBlocks.aircraftId, aircraftId),
        eq(aircraftScheduleBlocks.relatedQuoteId, quoteId),
        eq(aircraftScheduleBlocks.kind, "hold"),
      ),
    );
  if (dup) return { ok: false, error: "Already holding this aircraft for this quote" };

  const values: NewAircraftScheduleBlock = {
    aircraftId,
    kind: "hold",
    startAt,
    endAt,
    relatedQuoteId: quoteId,
    notes: q.code,
    createdByUserId: actor.id,
  };

  try {
    const [row] = await db
      .insert(aircraftScheduleBlocks)
      .values(values)
      .returning({ id: aircraftScheduleBlocks.id });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "quote.soft_hold.create",
      subjectType: "quote",
      subjectId: quoteId,
      subjectCode: q.code,
      metadata: {
        blockId: row.id,
        aircraftId,
        tailNumber: ac.tailNumber,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
    });

    revalidatePath(`/admin/quote/${quoteId}`);
    revalidatePath("/admin/ops");
    revalidatePath(`/admin/aircraft/${aircraftId}`);
    return { ok: true, blockId: row.id, expiresAt: endAt.toISOString() };
  } catch (err) {
    console.error("createSoftHold failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function releaseSoftHold(
  quoteId: string,
  blockId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireStaff();

  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (!UUID_RE.test(blockId)) return { ok: false, error: "Bad block id" };

  const [target] = await db
    .select({
      id: aircraftScheduleBlocks.id,
      kind: aircraftScheduleBlocks.kind,
      relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
      aircraftId: aircraftScheduleBlocks.aircraftId,
    })
    .from(aircraftScheduleBlocks)
    .where(eq(aircraftScheduleBlocks.id, blockId));
  if (!target) return { ok: false, error: "Hold not found" };
  if (target.relatedQuoteId !== quoteId || target.kind !== "hold") {
    return { ok: false, error: "Not a soft hold on this quote" };
  }

  await db
    .delete(aircraftScheduleBlocks)
    .where(eq(aircraftScheduleBlocks.id, target.id));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.soft_hold.release",
    subjectType: "quote",
    subjectId: quoteId,
    metadata: { blockId: target.id, aircraftId: target.aircraftId },
  });

  revalidatePath(`/admin/quote/${quoteId}`);
  revalidatePath("/admin/ops");
  revalidatePath(`/admin/aircraft/${target.aircraftId}`);
  return { ok: true };
}
