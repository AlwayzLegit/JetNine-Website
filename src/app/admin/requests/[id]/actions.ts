"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { trips, tripLegs, type NewTrip, type NewTripLeg } from "@/db/schema/trips";
import { invoices, type NewInvoice } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { aircraft } from "@/db/schema/aircraft";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { messages } from "@/db/schema/audit";
import { users } from "@/db/schema/users";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DEFAULT_MARKUP_PCT } from "@/lib/constants";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { attemptInvoiceDrawdown, type DrawdownOutcome } from "@/lib/membership-balance";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { REQUEST_NOT_FOUND, isUniqueViolation } from "@/domain/requests/commands";
import {
  requestAssignOp,
  requestHoldCreateOp,
  requestHoldReleaseOp,
  requestLinkClientOp,
  requestMessageOp,
  requestOptionAddOp,
  requestOptionChooseOp,
  requestOptionRemoveOp,
  requestOptionUpdateOp,
  requestSendOptionsOp,
  requestStatusOp,
} from "@/domain/requests/ops";
import { isDeskMessageChannel, type OptionFields } from "@/domain/requests/schemas";
import type { Err } from "@/domain/result";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PENDING = "This was sent for approval.";

/** The desk's wording for an op error: the shared "no request" sentence becomes "Quote not found"; the rest already reads the way the desk did. */
function deskError(r: Err): string {
  return r.code === "not_found" && r.error === REQUEST_NOT_FOUND ? "Quote not found" : r.error;
}

// The work itself is the "request.status" op (src/domain/requests), shared
// with the API and the approval queue; runOp revalidates the pages.
export async function updateQuoteStatus(
  quoteId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  const r = await runOp(requestStatusOp, session.value, { id: quoteId, status });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Invalid status" : r.code === "not_found" ? "Quote not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true };
}

// The work itself is the "request.assign" op (src/domain/requests).
export async function assignDispatcher(
  quoteId: string,
  staffId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (staffId !== null && !UUID_RE.test(staffId)) return { ok: false, error: "Unknown dispatcher" };
  const r = await runOp(requestAssignOp, session.value, { id: quoteId, staffId });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Unknown dispatcher" : deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}

// ─── attachMemberToQuote ──────────────────────────────────────────
// The dispatcher-side half of member linkage (the customer-side half is
// the signed-in auto-link in submitQuote). Pass null to detach. The work
// itself is the "request.linkClient" op (src/domain/requests), which also
// holds the converted lock.

export async function attachMemberToQuote(
  quoteId: string,
  memberId: string | null,
): Promise<{ ok: true; memberCode: string | null } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (memberId !== null && !UUID_RE.test(memberId)) return { ok: false, error: "Bad member id" };
  const r = await runOp(requestLinkClientOp, session.value, { id: quoteId, memberId });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Member not found" : deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, memberCode: (r.value.value as { memberCode: string | null }).memberCode };
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
  // /admin/requests/[id] before clicking Convert.
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

  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${quoteId}`);
  revalidatePath("/admin/trips");
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

  // Booking confirmation — until this existed, a customer who just
  // committed to a five-figure trip heard nothing (trips are inserted as
  // 'confirmed', bypassing the status-transition notifier). Best-effort:
  // a failed email never rolls back the conversion.
  try {
    let confirmTo = quote.contactSnapshot?.email?.trim() || null;
    if (!confirmTo && memberId) {
      const [m] = await db
        .select({ email: users.email })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.id, memberId));
      confirmTo = m?.email ?? null;
    }
    if (confirmTo) {
      const legs = await db
        .select({
          fromIata: quoteLegs.fromIata,
          toIata: quoteLegs.toIata,
          departDate: quoteLegs.departDate,
        })
        .from(quoteLegs)
        .where(eq(quoteLegs.quoteId, quoteId))
        .orderBy(asc(quoteLegs.legNumber));
      const itineraryLines = legs.map(
        (l) => `${l.fromIata ?? "—"} → ${l.toIata ?? "—"} · ${l.departDate ?? "date TBD"}`,
      );
      const result = await sendBookingConfirmationEmail({
        to: confirmTo,
        firstName: quote.contactSnapshot?.firstName?.trim() || "Hello",
        tripCode: inserted.trip.tripCode,
        quoteCode: quote.quoteCode,
        itineraryLines,
        paxCount: quote.paxCount,
        totalUsd: total,
        // The convert tx reverts the invoice to 'draft' whenever the reserve
        // didn't cover it (dispatcher reviews before the customer pays), and
        // the drawdown branch below handles the covered case — so the "pay
        // now" line is never right at convert time.
        invoiceIsDue: false,
        drawdown:
          inserted.drawdown?.drew
            ? {
                amountUsd: inserted.drawdown.amountUsd ?? 0,
                remainingBalanceUsd: inserted.drawdown.remainingBalanceUsd ?? 0,
              }
            : null,
      });
      await db.insert(messages).values({
        subjectType: "trip",
        subjectId: inserted.trip.id,
        channel: "email",
        direction: "out",
        toAddress: confirmTo,
        fromUserId: actor.id,
        preview: `Booking confirmation — ${inserted.trip.tripCode}`,
        body: `Booking confirmation email for ${inserted.trip.tripCode} (from ${quote.quoteCode}).`,
        isRead: false,
        deliveryStatus: result.ok ? (result.provider === "logger" ? "queued" : "sent") : "failed",
        deliveryProvider: result.ok ? result.provider : null,
        deliveryMessageId: result.ok ? (result.messageId ?? null) : null,
        deliveryError: result.ok
          ? result.provider === "logger"
            ? "email channel not configured — logged only, not delivered"
            : null
          : result.error.slice(0, 500),
        deliveredAt: result.ok && result.provider !== "logger" ? new Date() : null,
      });
    }
  } catch (err) {
    console.error("booking confirmation email failed (non-fatal)", err);
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
// The work itself is the "request.message" op (src/domain/requests).

export type PostQuoteMessageResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function postQuoteMessage(
  quoteId: string,
  formData: FormData,
): Promise<PostQuoteMessageResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const channel = ((formData.get("channel") as string | null) ?? "").trim();
  if (!isDeskMessageChannel(channel)) {
    return { ok: false, error: "Pick a channel" };
  }

  const body = ((formData.get("body") as string | null) ?? "").trim();
  if (body.length < 1) return { ok: false, error: "Body required" };
  if (body.length > 4000) return { ok: false, error: "Body too long (4000 max)" };

  const toAddress = ((formData.get("toAddress") as string | null) ?? "").trim() || undefined;

  const r = await runOp(requestMessageOp, session.value, { id: quoteId, channel, body, toAddress });
  if (!r.ok) return { ok: false, error: r.code === "not_found" ? "Quote not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, id: (r.value.value as { id: string }).id };
}

// ─── Soft holds ───────────────────────────────────────────────────────
// The work itself is the "request.hold.create" / "request.hold.release"
// ops (src/domain/requests): window derivation, dedupe and the race guard
// all live there.

export type CreateSoftHoldResult =
  | { ok: true; blockId: string; expiresAt: string }
  | { ok: false; error: string };

export async function createSoftHold(
  quoteId: string,
  aircraftId: string,
): Promise<CreateSoftHoldResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (!UUID_RE.test(aircraftId)) return { ok: false, error: "Bad aircraft id" };
  const r = await runOp(requestHoldCreateOp, session.value, { id: quoteId, aircraftId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  const { blockId, expiresAt } = r.value.value as { blockId: string; expiresAt: string };
  return { ok: true, blockId, expiresAt };
}

export async function releaseSoftHold(
  quoteId: string,
  blockId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  if (!UUID_RE.test(blockId)) return { ok: false, error: "Bad block id" };
  const r = await runOp(requestHoldReleaseOp, session.value, { id: quoteId, blockId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
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
// state. The work itself is the "request.option.*" ops (src/domain/requests):
// operator reconciliation, the safety floor and the markup pricing live
// there. These wrappers turn the form into the op's input.

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

/** The form's fields as the op's input; every field is set, so the op rewrites the whole row the way the form always did. */
function optionFieldsFromForm(formData: FormData): { fields: OptionFields } | { error: string } {
  const rawMarkup = soStr(formData.get("markupValue"));
  const markupValue = rawMarkup === null ? DEFAULT_MARKUP_PCT : Number(rawMarkup);
  if (!Number.isFinite(markupValue) || markupValue < 0) {
    return { error: "Markup must be a non-negative number" };
  }
  return {
    fields: {
      avinodeRef: soStr(formData.get("avinodeRef")),
      aircraftType: soStr(formData.get("aircraftType")),
      tailNumber: soStr(formData.get("tailNumber")),
      isFloatingFleet: soBool(formData.get("isFloatingFleet")),
      yearOfMake: soInt(formData.get("yearOfMake")),
      category: soStr(formData.get("category")),
      paxCapacity: soInt(formData.get("paxCapacity")),
      refurbInteriorYear: soInt(formData.get("refurbInteriorYear")),
      refurbExteriorYear: soInt(formData.get("refurbExteriorYear")),
      operatorNameRaw: soStr(formData.get("operatorNameRaw")),
      positioningTimeMin: soInt(formData.get("positioningTimeMin")),
      positioningAirport: soStr(formData.get("positioningAirport")),
      totalFlightTimeMin: soInt(formData.get("totalFlightTimeMin")),
      operatorCostUsd: soInt(formData.get("operatorCostUsd")),
      markupType: String(formData.get("markupType") ?? "percent") === "flat" ? "flat" : "percent",
      markupValue,
      dispatcherNotes: soStr(formData.get("dispatcherNotes")),
    },
  };
}

/** The option's request, so the op can check the option belongs to it. */
async function quoteIdForOption(optionId: string): Promise<{ quoteId: string } | { error: string }> {
  if (!UUID_RE.test(optionId)) return { error: "Bad option id" };
  const [opt] = await db
    .select({ quoteId: sourcedOptions.quoteId })
    .from(sourcedOptions)
    .where(eq(sourcedOptions.id, optionId))
    .limit(1);
  return opt ? { quoteId: opt.quoteId } : { error: "Option not found" };
}

export async function addSourcedOption(
  quoteId: string,
  formData: FormData,
): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  const built = optionFieldsFromForm(formData);
  if ("error" in built) return { ok: false, error: built.error };
  const r = await runOp(requestOptionAddOp, session.value, { id: quoteId, ...built.fields });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId: (r.value.value as { optionId: string }).optionId };
}

export async function updateSourcedOption(
  optionId: string,
  formData: FormData,
): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const ref = await quoteIdForOption(optionId);
  if ("error" in ref) return { ok: false, error: ref.error };
  const built = optionFieldsFromForm(formData);
  if ("error" in built) return { ok: false, error: built.error };
  const r = await runOp(requestOptionUpdateOp, session.value, { id: ref.quoteId, optionId, ...built.fields });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId };
}

export async function chooseSourcedOption(optionId: string): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const ref = await quoteIdForOption(optionId);
  if ("error" in ref) return { ok: false, error: ref.error };
  const r = await runOp(requestOptionChooseOp, session.value, { id: ref.quoteId, optionId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId };
}

export async function deleteSourcedOption(optionId: string): Promise<SourcedOptionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  const ref = await quoteIdForOption(optionId);
  if ("error" in ref) return { ok: false, error: ref.error };
  const r = await runOp(requestOptionRemoveOp, session.value, { id: ref.quoteId, optionId });
  if (!r.ok) return { ok: false, error: deskError(r) };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true, optionId };
}

// ─── Send options to the client ───────────────────────────────────────────
// The action that closes the funnel. The work itself is the
// "request.sendOptions" op (src/domain/requests), shared with the API.

export type SendOptionsResult =
  | { ok: true; count: number; to: string; delivery: "sent" | "queued" }
  | { ok: false; error: string };

export async function sendOptionsToClient(quoteId: string): Promise<SendOptionsResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };
  if (!UUID_RE.test(quoteId)) return { ok: false, error: "Bad quote id" };
  const r = await runOp(requestSendOptionsOp, session.value, { id: quoteId });
  if (!r.ok) return { ok: false, error: r.code === "not_found" ? "Quote not found" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  const { count, to, delivery } = r.value.value as { count: number; to: string; delivery: "sent" | "queued" };
  return { ok: true, count, to, delivery };
}
