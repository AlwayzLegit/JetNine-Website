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
import { requireStaff } from "@/lib/auth";

type Status = (typeof quoteStatusEnum.enumValues)[number];

function isStatus(v: string): v is Status {
  return (quoteStatusEnum.enumValues as readonly string[]).includes(v);
}

export async function updateQuoteStatus(
  quoteId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff();
  if (!isStatus(status)) return { ok: false, error: "Invalid status" };

  await db
    .update(quotes)
    .set({ status, respondedAt: respondedAtPatch(status) })
    .where(eq(quotes.id, quoteId));

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
  await requireStaff();

  if (staffId) {
    const [exists] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.id, staffId));
    if (!exists) return { ok: false, error: "Unknown dispatcher" };
  }

  await db
    .update(quotes)
    .set({ assignedDispatcherId: staffId })
    .where(eq(quotes.id, quoteId));

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
  await requireStaff();

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

  return {
    ok: true,
    tripId: inserted.trip.id,
    tripCode: inserted.trip.tripCode,
    invoiceId: inserted.invoice.id,
  };
}
