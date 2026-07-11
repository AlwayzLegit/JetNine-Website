"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs, quoteStatusEnum } from "@/db/schema/quotes";
import { trips, tripLegs, type NewTrip, type NewTripLeg } from "@/db/schema/trips";
import { invoices, type NewInvoice } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { staff } from "@/db/schema/staff";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { sourcedOptions, type NewSourcedOption } from "@/db/schema/sourced-option";
import { DEFAULT_MARKUP_PCT } from "@/lib/constants";
import { isSourcingEligible, normalizeCategory } from "@/lib/operator-eligibility";
import {
  aircraftScheduleBlocks,
  type NewAircraftScheduleBlock,
} from "@/db/schema/schedule-blocks";
import {
  messageChannelEnum,
  messages,
  type NewMessage,
} from "@/db/schema/audit";
import { users } from "@/db/schema/users";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendQuoteOptionsEmail, type QuoteOptionEmailItem } from "@/lib/email";
import { attemptInvoiceDrawdown, type DrawdownOutcome } from "@/lib/membership-balance";
import { dispatchThreadMessage, type ThreadChannel } from "@/lib/message-delivery";
import { isE164, toE164 } from "@/lib/phone";

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

// ─── attachMemberToQuote ──────────────────────────────────────────
// The dispatcher-side half of member linkage (the customer-side half is
// the signed-in auto-link in submitQuote). Pass null to detach. Locked
// once the quote is converted — the trip + invoice already carry the
// member, so a late re-link would desync the chain.

export async function attachMemberToQuote(
  quoteId: string,
  memberId: string | null,
): Promise<{ ok: true; memberCode: string | null } | { ok: false; error: string }> {
  const actor = await requireStaff();

  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (memberId !== null && !UUID_RE.test(memberId)) {
    return { ok: false, error: "Bad member id" };
  }

  const [q] = await db
    .select({
      id: quotes.id,
      code: quotes.quoteCode,
      memberId: quotes.memberId,
      convertedTripId: quotes.convertedTripId,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId));
  if (!q) return { ok: false, error: "Quote not found" };
  if (q.convertedTripId) {
    return { ok: false, error: "Quote already converted — member is locked to the trip" };
  }

  let memberCode: string | null = null;
  if (memberId) {
    const [m] = await db
      .select({ id: members.id, memberCode: members.memberCode })
      .from(members)
      .where(eq(members.id, memberId));
    if (!m) return { ok: false, error: "Member not found" };
    memberCode = m.memberCode;
  }

  await db
    .update(quotes)
    .set({ memberId, updatedAt: new Date() })
    .where(eq(quotes.id, quoteId));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: memberId ? "quote.member.attach" : "quote.member.detach",
    subjectType: "quote",
    subjectId: quoteId,
    subjectCode: q.code,
    diff: { memberId: { before: q.memberId, after: memberId } },
    metadata: { memberCode },
  });

  revalidatePath(`/admin/quote/${quoteId}`);
  revalidatePath("/admin/dispatch");
  return { ok: true, memberCode };
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

  // Resolve member: quote must already have an explicit memberId. The
  // previous auto-bind-by-contactSnapshot.email was an IDOR — the contact
  // form is unauthenticated, so an attacker could submit a quote with a
  // victim's email and convert-time would attach the trip + invoice to
  // (and auto-draw from the reserve of) the unrelated victim's account.
  // Member linkage now requires either (a) the customer signed in before
  // submitting, or (b) a dispatcher explicitly attached a member at
  // /admin/quote/[id] before clicking Convert.
  const memberId = quote.memberId;
  if (!memberId) {
    return {
      ok: false,
      error:
        "Attach a member to this quote first (the customer must sign in, or you must link a member from the quote workbench).",
    };
  }

  const legs = await db
    .select()
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, quoteId))
    .orderBy(asc(quoteLegs.legNumber));
  if (legs.length === 0) return { ok: false, error: "Quote has no legs" };

  // Pricing — if a sourced option has been chosen, its client price +
  // operator cost drive the trip/invoice; otherwise fall back to the
  // indicative midpoint (backward compatible with pre-Avinode quotes).
  const [chosen] = await db
    .select()
    .from(sourcedOptions)
    .where(and(eq(sourcedOptions.quoteId, quoteId), eq(sourcedOptions.isChosen, true)))
    .limit(1);

  const subtotal =
    chosen?.clientPriceUsd != null
      ? chosen.clientPriceUsd
      : quote.indicativeLowUsd && quote.indicativeHighUsd
        ? Math.round((quote.indicativeLowUsd + quote.indicativeHighUsd) / 2)
        : null;
  // FET is 7.5% of subtotal. Use null-check (not truthy) so a $0
  // subtotal correctly produces fet=0 instead of fet=null — the
  // downstream `fetUsd is known iff subtotalUsd is known` invariant
  // matters for revenue reports.
  const fet = subtotal !== null ? Math.round(subtotal * 0.075) : null;
  const seg = Math.round(SEGMENT_FEE_USD * quote.paxCount * legs.length);
  const total = subtotal !== null ? subtotal + (fet ?? 0) + seg : null;

  // Operator cost + true margin + tail/operator linkage from the chosen
  // option (all null when converting without a sourced option).
  const operatorCostUsd = chosen?.operatorCostUsd ?? null;
  const marginPct =
    chosen && subtotal && subtotal > 0 && operatorCostUsd != null
      ? String(Math.round(((subtotal - operatorCostUsd) / subtotal) * 10000) / 100)
      : null;
  const tripOperatorId = chosen?.operatorId ?? null;
  let tripAircraftId: string | null = null;
  if (chosen?.tailNumber) {
    const [ac] = await db
      .select({ id: aircraft.id })
      .from(aircraft)
      .where(eq(aircraft.tailNumber, chosen.tailNumber))
      .limit(1);
    tripAircraftId = ac?.id ?? null;
  }

  let inserted: {
    trip: { id: string; tripCode: string };
    invoice: { id: string };
    drawdown: DrawdownOutcome | null;
  };
  try {
    inserted = await db.transaction(async (tx) => {
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
          (l) => isInternationalIcao(l.fromIcao) || isInternationalIcao(l.toIcao),
        ),
        status: "confirmed",
        revenueUsd: subtotal,
        operatorCostUsd,
        marginPct,
        aircraftId: tripAircraftId,
        operatorId: tripOperatorId,
      };
      // Insert the trip first — the partial unique index
      // `trips_quote_id_uniq` (migration 0032) makes this the
      // serialization point against concurrent convertQuoteToTrip
      // calls on the same quote (dispatcher double-click, two-tab
      // race). The second caller bounces here with SQLSTATE 23505
      // and we surface "already converted" to the caller below.
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

      // Release any soft holds this quote had on aircraft. Without this,
      // the holds linger forever — /admin/ops shows phantom blocks on the
      // tail, and the manual deleteScheduleBlock path refuses to remove
      // rows with relatedQuoteId set ("cancel the trip or release the
      // hold instead"). Doing the delete inside the convert tx keeps the
      // ops calendar consistent with the trip's new confirmed state.
      await tx
        .delete(aircraftScheduleBlocks)
        .where(
          and(
            eq(aircraftScheduleBlocks.relatedQuoteId, quoteId),
            eq(aircraftScheduleBlocks.kind, "hold"),
          ),
        );

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
  } catch (err) {
    // Race: a parallel convertQuoteToTrip call already won. The unique
    // index on trips(quote_id) returns SQLSTATE 23505. Re-read the quote
    // and surface the existing trip rather than dropping the user into
    // a generic error.
    if (isUniqueViolation(err)) {
      const [requoted] = await db
        .select({
          convertedTripId: quotes.convertedTripId,
          quoteCode: quotes.quoteCode,
        })
        .from(quotes)
        .where(eq(quotes.id, quoteId));
      return {
        ok: false,
        error: requoted?.convertedTripId
          ? `Already converted to trip ${requoted.convertedTripId}`
          : "Convert raced with another writer — refresh and try again.",
      };
    }
    throw err;
  }

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
  "whatsapp",
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

  // Default to-address per channel: email → contact.email; phone channels
  // → contact phone normalized to E.164. Post-launch quotes are stored
  // already-normalized via toE164 at intake; for legacy rows still in
  // "(818) 800-5678" form, re-normalize here so Twilio doesn't 21211.
  const contactPhoneE164 = q.contactSnapshot?.phoneE164 ?? null;
  const contactPhoneCC = q.contactSnapshot?.phoneCountry ?? null;
  const normalizedPhone = isE164(contactPhoneE164)
    ? contactPhoneE164
    : toE164(contactPhoneE164, contactPhoneCC);

  const defaultTo =
    channelRaw === "email"
      ? q.contactSnapshot?.email ?? null
      : channelRaw === "sms" ||
          channelRaw === "whatsapp" ||
          channelRaw === "call" ||
          channelRaw === "voicemail"
        ? normalizedPhone
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
    // The new partial unique index (migration 0032) catches the TOCTOU
    // race where two dispatchers both passed the dup-check above and
    // both try to insert. Surface the same friendly message the app
    // check would have.
    if (isUniqueViolation(err)) {
      return { ok: false, error: "Already holding this aircraft for this quote" };
    }
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

// Postgres unique-violation SQLSTATE. Drizzle bubbles the underlying
// postgres-js error which exposes `.code` as the SQLSTATE.
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: string }).code === "23505";
}

/**
 * ICAO prefixes that indicate the airport is OUTSIDE the United States
 * (and US territories) for customs / APIS purposes. The previous
 * `!startsWith("K")` heuristic wrongly flagged P** (Hawaii, Alaska,
 * Guam — PHNL, PANC, PGUM) and T** (PR, USVI — TJSJ, TIST) as
 * international, triggering eAPIS / customs paperwork on what are
 * actually domestic-territory flights. Correct rule: K** (CONUS) and
 * the territory P** / T** prefixes below are domestic; everything
 * else (CY**, EG**, M**, LF**, RJ**, etc.) is international.
 *
 * Source: ICAO Doc 7910 region-code allocations. Hawaii=PH, Alaska=PA,
 * Guam=PG, Puerto Rico=TJ, USVI=TI. American Samoa (NSTU) and Northern
 * Mariana Islands (PG**) round out the territories — NSTU is N**
 * which would otherwise be flagged, so listed explicitly.
 */
const US_DOMESTIC_ICAO_PREFIXES = ["K", "PH", "PA", "PG", "TJ", "TI"] as const;
const US_DOMESTIC_FULL_ICAO = new Set(["NSTU"]); // American Samoa, lone N** territory

function isInternationalIcao(icao: string | null): boolean {
  if (!icao) return false;
  if (US_DOMESTIC_FULL_ICAO.has(icao)) return false;
  return !US_DOMESTIC_ICAO_PREFIXES.some((p) => icao.startsWith(p));
}

// ─── Sourced options (Avinode paste-in) ────────────────────────────────────
// Airframes a dispatcher pastes from Avinode during a quote's `sourcing`
// state. On save we reconcile the pasted seller name against the operators
// table, snapshot its vetting, enforce the safety floor, and apply markup to
// turn operator cost into client price. The chosen option drives trip +
// invoice pricing at convert (see convertQuoteToTrip above).

export type SourcedOptionResult =
  | { ok: true; optionId: string }
  | { ok: false; error: string };

function soStr(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}
function soInt(v: FormDataEntryValue | null): number | null {
  const s = v == null ? "" : String(v).trim();
  if (s === "") return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) ? n : null;
}
function soBool(v: FormDataEntryValue | null): boolean {
  const s = String(v ?? "").toLowerCase();
  return s === "on" || s === "true" || s === "1";
}

function computeClientPrice(
  costUsd: number | null,
  markupType: "percent" | "flat",
  markupValue: number,
): number | null {
  if (costUsd == null) return null;
  return markupType === "flat"
    ? costUsd + Math.round(markupValue)
    : Math.round(costUsd * (1 + markupValue / 100));
}

type MatchedOperator = {
  id: string;
  name: string;
  status: string;
  argusRating: (typeof operators.$inferSelect)["argusRating"];
  wyvernWingman: boolean;
  isbaoStage: number | null;
  insuranceRenewsOn: string | null;
  nextAuditOn: string | null;
};

// Fuzzy-match a pasted Avinode seller name against the operators table: try
// a full contains-match, then fall back to the first token.
async function reconcileOperator(nameRaw: string | null): Promise<MatchedOperator | null> {
  const q = nameRaw?.trim();
  if (!q || q.length < 2) return null;
  const cols = {
    id: operators.id,
    name: operators.name,
    status: operators.status,
    argusRating: operators.argusRating,
    wyvernWingman: operators.wyvernWingman,
    isbaoStage: operators.isbaoStage,
    insuranceRenewsOn: operators.insuranceRenewsOn,
    nextAuditOn: operators.nextAuditOn,
  };
  const [full] = await db.select(cols).from(operators).where(ilike(operators.name, `%${q}%`)).limit(1);
  if (full) return full;
  const first = q.split(/\s+/)[0];
  if (first.length >= 3) {
    const [tok] = await db.select(cols).from(operators).where(ilike(operators.name, `%${first}%`)).limit(1);
    if (tok) return tok;
  }
  return null;
}

// Shared field extraction + reconciliation + pricing for add/update.
async function buildOptionValues(
  formData: FormData,
): Promise<
  | { fields: Partial<NewSourcedOption>; meta: { operatorMatched: boolean; safetyFloorPassed: boolean } }
  | { error: string }
> {
  const operatorCostUsd = soInt(formData.get("operatorCostUsd"));
  const markupType: "percent" | "flat" =
    String(formData.get("markupType") ?? "percent") === "flat" ? "flat" : "percent";
  const rawMarkup = soStr(formData.get("markupValue"));
  const markupValue = rawMarkup === null ? DEFAULT_MARKUP_PCT : Number(rawMarkup);
  if (!Number.isFinite(markupValue) || markupValue < 0) {
    return { error: "Markup must be a non-negative number" };
  }

  const operatorNameRaw = soStr(formData.get("operatorNameRaw"));
  const op = await reconcileOperator(operatorNameRaw);
  const operatorMatched = op !== null;
  const eligibility = op ? isSourcingEligible(op) : null;
  // Safety floor passes only for a matched, eligible operator. An unmatched
  // seller stays false → the UI shows "screen before send" and choose blocks.
  const safetyFloorPassed = operatorMatched && eligibility!.eligible;

  const fields: Partial<NewSourcedOption> = {
    avinodeRef: soStr(formData.get("avinodeRef")),
    aircraftType: soStr(formData.get("aircraftType")),
    tailNumber: soStr(formData.get("tailNumber")),
    isFloatingFleet: soBool(formData.get("isFloatingFleet")),
    yearOfMake: soInt(formData.get("yearOfMake")),
    category: normalizeCategory(soStr(formData.get("category"))),
    paxCapacity: soInt(formData.get("paxCapacity")),
    refurbInteriorYear: soInt(formData.get("refurbInteriorYear")),
    refurbExteriorYear: soInt(formData.get("refurbExteriorYear")),
    operatorNameRaw,
    operatorId: op?.id ?? null,
    operatorMatched,
    argusRating: op?.argusRating ?? null,
    wyvernWingman: op?.wyvernWingman ?? null,
    isbaoStage: op?.isbaoStage ?? null,
    safetyFloorPassed,
    positioningTimeMin: soInt(formData.get("positioningTimeMin")),
    positioningAirport: soStr(formData.get("positioningAirport")),
    totalFlightTimeMin: soInt(formData.get("totalFlightTimeMin")),
    operatorCostUsd,
    markupType,
    markupValue: String(markupValue),
    clientPriceUsd: computeClientPrice(operatorCostUsd, markupType, markupValue),
    dispatcherNotes: soStr(formData.get("dispatcherNotes")),
  };
  return { fields, meta: { operatorMatched, safetyFloorPassed } };
}

export async function addSourcedOption(
  quoteId: string,
  formData: FormData,
): Promise<SourcedOptionResult> {
  const actor = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return { ok: false, error: "Bad quote id" };
  const [quote] = await db
    .select({ id: quotes.id, code: quotes.quoteCode })
    .from(quotes)
    .where(eq(quotes.id, quoteId));
  if (!quote) return { ok: false, error: "Quote not found" };

  const built = await buildOptionValues(formData);
  if ("error" in built) return { ok: false, error: built.error };

  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`coalesce(max(${sourcedOptions.optionNumber}), 0)` })
    .from(sourcedOptions)
    .where(eq(sourcedOptions.quoteId, quoteId));
  const optionNumber = Number(maxNum) + 1;

  const [row] = await db
    .insert(sourcedOptions)
    .values({ quoteId, optionNumber, ...built.fields })
    .returning({ id: sourcedOptions.id });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.option.add",
    subjectType: "quote",
    subjectId: quoteId,
    subjectCode: quote.code,
    metadata: {
      optionId: row.id,
      optionNumber,
      ...built.meta,
      operatorCostUsd: built.fields.operatorCostUsd,
      clientPriceUsd: built.fields.clientPriceUsd,
    },
  });
  revalidatePath(`/admin/quote/${quoteId}`);
  return { ok: true, optionId: row.id };
}

export async function updateSourcedOption(
  optionId: string,
  formData: FormData,
): Promise<SourcedOptionResult> {
  const actor = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(optionId)) return { ok: false, error: "Bad option id" };
  const [opt] = await db
    .select({ id: sourcedOptions.id, quoteId: sourcedOptions.quoteId })
    .from(sourcedOptions)
    .where(eq(sourcedOptions.id, optionId));
  if (!opt) return { ok: false, error: "Option not found" };

  const built = await buildOptionValues(formData);
  if ("error" in built) return { ok: false, error: built.error };

  await db
    .update(sourcedOptions)
    .set({ ...built.fields, updatedAt: new Date() })
    .where(eq(sourcedOptions.id, optionId));
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.option.update",
    subjectType: "quote",
    subjectId: opt.quoteId,
    metadata: { optionId, ...built.meta },
  });
  revalidatePath(`/admin/quote/${opt.quoteId}`);
  return { ok: true, optionId };
}

export async function chooseSourcedOption(optionId: string): Promise<SourcedOptionResult> {
  const actor = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(optionId)) return { ok: false, error: "Bad option id" };
  const [opt] = await db.select().from(sourcedOptions).where(eq(sourcedOptions.id, optionId));
  if (!opt) return { ok: false, error: "Option not found" };
  if (!opt.safetyFloorPassed) {
    return {
      ok: false,
      error: opt.operatorMatched
        ? "Operator fails the safety floor — cannot choose"
        : "Operator unmatched — screen + match before choosing",
    };
  }
  if (opt.clientPriceUsd == null || opt.clientPriceUsd <= 0) {
    return { ok: false, error: "Set operator cost + markup before choosing" };
  }
  await db.transaction(async (tx) => {
    await tx
      .update(sourcedOptions)
      .set({ isChosen: false, updatedAt: new Date() })
      .where(eq(sourcedOptions.quoteId, opt.quoteId));
    await tx
      .update(sourcedOptions)
      .set({ isChosen: true, status: "shortlisted", updatedAt: new Date() })
      .where(eq(sourcedOptions.id, optionId));
  });
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.option.choose",
    subjectType: "quote",
    subjectId: opt.quoteId,
    metadata: { optionId, clientPriceUsd: opt.clientPriceUsd, operatorCostUsd: opt.operatorCostUsd },
  });
  revalidatePath(`/admin/quote/${opt.quoteId}`);
  return { ok: true, optionId };
}

export async function deleteSourcedOption(optionId: string): Promise<SourcedOptionResult> {
  const actor = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(optionId)) return { ok: false, error: "Bad option id" };
  const [opt] = await db
    .select({ id: sourcedOptions.id, quoteId: sourcedOptions.quoteId })
    .from(sourcedOptions)
    .where(eq(sourcedOptions.id, optionId));
  if (!opt) return { ok: false, error: "Option not found" };
  await db.delete(sourcedOptions).where(eq(sourcedOptions.id, optionId));
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.option.remove",
    subjectType: "quote",
    subjectId: opt.quoteId,
    metadata: { optionId },
  });
  revalidatePath(`/admin/quote/${opt.quoteId}`);
  return { ok: true, optionId };
}

// ─── Send options to the client ───────────────────────────────────────────
// The action that closes the funnel: emails every sendable sourced option
// (safety floor passed + priced) to the client as a branded quote sheet,
// records the send on the message thread with an HONEST delivery status
// (a dark email channel records `queued`, not a false `sent`), flips the
// sent options to `sent_to_client`, and advances the quote to
// `options_sent` when it's still in an earlier state.

const CATEGORY_EMAIL_LABEL: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light jet",
  midsize: "Midsize jet",
  supermid: "Super-midsize jet",
  heavy: "Heavy jet",
  ulr: "Ultra long range",
};

const ARGUS_LABEL: Record<string, string> = {
  platinum: "ARG/US Platinum",
  gold: "ARG/US Gold",
  silver: "ARG/US Silver",
};

export type SendOptionsResult =
  | { ok: true; count: number; to: string; delivery: "sent" | "queued" }
  | { ok: false; error: string };

export async function sendOptionsToClient(quoteId: string): Promise<SendOptionsResult> {
  const actor = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return { ok: false, error: "Bad quote id" };

  const [q] = await db
    .select({
      id: quotes.id,
      code: quotes.quoteCode,
      status: quotes.status,
      paxCount: quotes.paxCount,
      memberId: quotes.memberId,
      contactSnapshot: quotes.contactSnapshot,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId));
  if (!q) return { ok: false, error: "Quote not found" };

  // Recipient: contact snapshot first, member's account email as fallback.
  let toEmail = q.contactSnapshot?.email?.trim() || null;
  let toUserId: string | null = null;
  if (q.memberId) {
    const [m] = await db
      .select({ userId: members.userId, email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.id, q.memberId));
    toUserId = m?.userId ?? null;
    if (!toEmail) toEmail = m?.email ?? null;
  }
  if (!toEmail) return { ok: false, error: "No client email on this quote" };

  // Sendable = vetted operator + priced. Blocked/unmatched options never
  // reach the client by construction.
  const opts = await db
    .select()
    .from(sourcedOptions)
    .where(and(eq(sourcedOptions.quoteId, quoteId), eq(sourcedOptions.safetyFloorPassed, true)))
    .orderBy(asc(sourcedOptions.optionNumber));
  const sendable = opts.filter((o) => o.clientPriceUsd != null && o.clientPriceUsd > 0);
  if (sendable.length === 0) {
    return { ok: false, error: "No sendable options — need vetted + priced" };
  }

  const legs = await db
    .select({ fromIata: quoteLegs.fromIata, toIata: quoteLegs.toIata })
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, quoteId))
    .orderBy(asc(quoteLegs.legNumber));
  const route =
    legs.map((l) => `${l.fromIata ?? "—"} → ${l.toIata ?? "—"}`).join(" · ") || "your route";

  const items: QuoteOptionEmailItem[] = sendable.map((o) => {
    const vetting = [
      o.argusRating && o.argusRating !== "none" ? ARGUS_LABEL[o.argusRating] : null,
      o.wyvernWingman ? "Wyvern Wingman" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      optionNumber: o.optionNumber,
      aircraftType: o.aircraftType,
      yearOfMake: o.yearOfMake,
      paxCapacity: o.paxCapacity,
      categoryLabel: o.category ? (CATEGORY_EMAIL_LABEL[o.category] ?? o.category) : null,
      vetting: vetting || null,
      clientPriceUsd: o.clientPriceUsd!,
    };
  });

  const firstName = q.contactSnapshot?.firstName?.trim() || "Hello";
  const result = await sendQuoteOptionsEmail({
    quoteCode: q.code,
    firstName,
    to: toEmail,
    route,
    paxCount: q.paxCount,
    options: items,
  });
  if (!result.ok) {
    return { ok: false, error: `Email failed: ${result.error.slice(0, 120)}` };
  }

  // Honest status: logger mode means nothing actually left the building.
  const delivery: "sent" | "queued" = result.provider === "logger" ? "queued" : "sent";
  const summary = `Options sheet — ${sendable.length} airframe${sendable.length === 1 ? "" : "s"}: ${sendable
    .map((o) => `${o.aircraftType ?? "aircraft"} ${formatUSDShort(o.clientPriceUsd!)}`)
    .join(", ")}`;
  const preview = summary.length > 140 ? `${summary.slice(0, 139)}…` : summary;

  await db.insert(messages).values({
    subjectType: "quote",
    subjectId: quoteId,
    channel: "email",
    direction: "out",
    fromAddress: null,
    toAddress: toEmail,
    fromUserId: actor.id,
    toUserId,
    preview,
    body: summary,
    isRead: false,
    deliveryStatus: delivery,
    deliveryProvider: result.provider,
    deliveryMessageId: result.messageId ?? null,
    deliveryError:
      delivery === "queued" ? "email channel not configured — logged only, not delivered" : null,
    deliveredAt: delivery === "sent" ? new Date() : null,
  });

  // Flip the sent options + advance the quote (never regress a later state).
  await db
    .update(sourcedOptions)
    .set({ status: "sent_to_client", updatedAt: new Date() })
    .where(
      and(
        eq(sourcedOptions.quoteId, quoteId),
        inArray(
          sourcedOptions.id,
          sendable.map((o) => o.id),
        ),
      ),
    );
  if (["submitted", "triaged", "sourcing"].includes(q.status)) {
    await db
      .update(quotes)
      .set({ status: "options_sent", respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "quote.options.send",
    subjectType: "quote",
    subjectId: quoteId,
    subjectCode: q.code,
    metadata: { count: sendable.length, to: toEmail, provider: result.provider, delivery },
  });

  revalidatePath(`/admin/quote/${quoteId}`);
  return { ok: true, count: sendable.length, to: toEmail, delivery };
}

function formatUSDShort(n: number): string {
  return `$${Math.round(n / 1000)}k`;
}
