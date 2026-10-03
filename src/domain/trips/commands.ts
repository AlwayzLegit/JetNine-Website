import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages, type NewMessage } from "@/db/schema/audit";
import { invoices, type Invoice } from "@/db/schema/invoices";
import { memberPreferences } from "@/db/schema/member-prefs";
import { members } from "@/db/schema/members";
import { reserveTransactions, type NewReserveTransaction } from "@/db/schema/memberships";
import { tripLegs, trips, tripStatusEnum } from "@/db/schema/trips";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import {
  isNotifiableTripStatus,
  sendDispatchAlert,
  sendInvoiceIssuedEmail,
  sendRefundIssuedEmail,
  sendTripStatusEmail,
  type TripNotifyStatus,
} from "@/lib/email";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { postThreadMessage } from "@/domain/requests/commands";
import { err, ok, type Result } from "@/domain/result";
import type { InvoiceUpdateInput, TripMessageInput, TripStatusInput } from "./schemas";

/**
 * Trip commands behind the ops in ./ops.ts. Same shape as the request
 * commands: a `load*` for the current rows and a command that runs
 * against them, with no session check or revalidation of its own.
 *
 * Keep this file free of `server-only` imports (stripe, twilio):
 * scripts/check-api.mts loads the route registry under tsx. Those two
 * are reached through a dynamic import where they are needed.
 */

export type TripStatus = (typeof tripStatusEnum.enumValues)[number];
export const TRIP_NOT_FOUND = "No trip with that id.";
const NOT_FOUND = TRIP_NOT_FOUND;
type AuditActor = ReturnType<typeof auditFields>;

export type TripMessageState = {
  trip: { id: string; code: string; memberId: string; memberUserId: string };
  defaultTo: string | null;
  finalTo: string | null;
};

export async function loadTripForMessage(input: TripMessageInput): Promise<Result<TripMessageState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  // A trip always has a client; the joins also give the default address.
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
    .where(eq(trips.id, input.id))
    .limit(1);
  if (!t) return err("not_found", NOT_FOUND);

  const c = input.channel;
  const defaultTo = c === "email" ? t.memberEmail : c === "sms" || c === "call" || c === "voicemail" ? t.memberPhone : null;

  return ok({
    trip: { id: t.id, code: t.code, memberId: t.memberId, memberUserId: t.memberUserId },
    defaultTo,
    finalTo: input.toAddress ?? defaultTo,
  });
}

export async function postTripMessage(
  actor: Actor,
  input: TripMessageInput,
  state: TripMessageState,
): Promise<Result<{ id: string }>> {
  const { trip } = state;
  const posted = await postThreadMessage({
    subjectType: "trip",
    subjectId: trip.id,
    code: trip.code,
    channel: input.channel,
    body: input.body,
    toAddress: state.finalTo,
    toUserId: trip.memberUserId,
    fromUserId: actor.userId,
  });
  if (!posted.ok) return posted;

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "trip.message.post",
    subjectType: "trip",
    subjectId: trip.id,
    subjectCode: trip.code,
    metadata: {
      ...a.metadata,
      messageId: posted.value.messageId,
      channel: input.channel,
      toAddress: state.finalTo,
      bodyLen: input.body.length,
      delivery: posted.value.delivery,
    },
  });

  return ok({ id: posted.value.messageId });
}

// ─── Status ──────────────────────────────────────────────────────────────

export type TripStatusState = {
  trip: { id: string; code: string; status: TripStatus };
};

export async function loadTripForStatus(input: TripStatusInput): Promise<Result<TripStatusState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [t] = await db
    .select({ id: trips.id, code: trips.tripCode, status: trips.status })
    .from(trips)
    .where(eq(trips.id, input.id))
    .limit(1);
  if (!t) return err("not_found", NOT_FOUND);
  return ok({ trip: t });
}

export function isCancelledStatus(s: string): s is "cancelled_wx" | "cancelled_other" {
  return s === "cancelled_wx" || s === "cancelled_other";
}

/** A cancellation that changes the status unwinds reserve draws and card payments. */
export function tripStatusRefunds(input: TripStatusInput, state: TripStatusState): boolean {
  return isCancelledStatus(input.status) && state.trip.status !== input.status;
}

/** A change into a client-facing milestone emails (and, with opt-in, texts) the client. */
export function tripStatusNotifies(input: TripStatusInput, state: TripStatusState): boolean {
  return isNotifiableTripStatus(input.status) && state.trip.status !== input.status;
}

/**
 * Move a trip to a new status. Wheels timestamps are stamped on the obvious
 * milestones; a cancellation refunds the client (reserve draws, then card
 * payments); a client-facing milestone notifies them. Every send is
 * best-effort and happens after the row is written, so a failed email never
 * blocks the status change.
 */
export async function setTripStatus(
  actor: Actor,
  input: TripStatusInput,
  state: TripStatusState,
): Promise<Result<{ id: string; status: TripStatus }>> {
  const { trip } = state;
  const status = input.status;
  const a = auditFields(actor);

  const patch: Partial<typeof trips.$inferInsert> = { status };
  const now = new Date();
  if (status === "airborne") patch.wheelsUpAt = now;
  if (status === "wheels_down" || status === "completed") patch.wheelsDownAt = now;

  await db.update(trips).set(patch).where(eq(trips.id, trip.id));

  // Auto-refund: when a trip transitions into a cancelled state, look for
  // any charter_draw rows inserted at conversion time and post
  // equal-and-opposite refund rows so the member's balance is made whole.
  // Only these two states — `diverted` and `irregular_ops` mean the trip
  // still happened (or partly happened), so refund policy is ops-decided.
  let refund: { count: number; totalUsd: number } | null = null;
  let cardRefund: { refunded: number; failed: number; totalUsd: number } | null = null;
  if (tripStatusRefunds(input, state) && isCancelledStatus(status)) {
    refund = await refundChartDrawsForTrip({ tripId: trip.id, reason: status, tripCode: trip.code, audit: a });
    // Same policy for card payments: reserve draws have auto-refunded since
    // they shipped, but a card-paid invoice was only ever voided on paper —
    // the customer stayed charged. Mirrors the reserve path's transitions
    // and idempotency (only status='paid' rows are touched, and Stripe
    // rejects a second full refund of the same intent).
    cardRefund = await refundCardPaymentsForTrip({ tripId: trip.id, tripCode: trip.code, audit: a });
  }

  // Client-facing status notifications, logged as message rows on the trip
  // thread so they show in the workbench and, on failure, in the
  // failed-delivery panel for retry.
  let notification: { status: "sent" | "failed" | "skipped"; error?: string } = { status: "skipped" };
  if (tripStatusNotifies(input, state) && isNotifiableTripStatus(status)) {
    notification = await notifyTripStatus({ tripId: trip.id, tripCode: trip.code, newStatus: status, actorUserId: actor.userId });
  }

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "trip.status.update",
    subjectType: "trip",
    subjectId: trip.id,
    subjectCode: trip.code,
    diff: { status: { before: trip.status, after: status } },
    metadata: {
      ...a.metadata,
      wheelsUpAt: patch.wheelsUpAt?.toISOString() ?? null,
      wheelsDownAt: patch.wheelsDownAt?.toISOString() ?? null,
      notification,
      refund,
      cardRefund,
    },
  });

  return ok({ id: trip.id, status });
}

async function notifyTripStatus(args: {
  tripId: string;
  tripCode: string | null;
  newStatus: TripNotifyStatus;
  actorUserId: string | null;
}): Promise<{ status: "sent" | "failed" | "skipped"; error?: string }> {
  // Member + itinerary lookups are independent — parallelize.
  const [targetRows, legs] = await Promise.all([
    db
      .select({
        memberUserId: members.userId,
        memberEmail: users.email,
        memberPhone: users.phoneE164,
        memberFirstName: users.firstName,
        paxCount: trips.paxCount,
        smsOptIn: memberPreferences.commsSmsUpdates,
        quietStart: memberPreferences.quietHoursStart,
        quietEnd: memberPreferences.quietHoursEnd,
        quietTz: memberPreferences.quietHoursTz,
      })
      .from(trips)
      .innerJoin(members, eq(members.id, trips.memberId))
      .innerJoin(users, eq(users.id, members.userId))
      .leftJoin(memberPreferences, eq(memberPreferences.memberId, trips.memberId))
      .where(eq(trips.id, args.tripId)),
    db
      .select({ fromIcao: tripLegs.fromIcao, toIcao: tripLegs.toIcao, departDate: tripLegs.departDate })
      .from(tripLegs)
      .where(eq(tripLegs.tripId, args.tripId))
      .orderBy(asc(tripLegs.legNumber)),
  ]);
  const target = targetRows[0];

  if (!target || !args.tripCode) return { status: "skipped" };
  if (!target.memberEmail && !target.memberPhone) return { status: "skipped" };

  const itineraryLines = legs
    .slice(0, 4) // cap to 4 lines so the email stays scannable
    .map((l) => {
      const route = `${l.fromIcao ?? "—"} → ${l.toIcao ?? "—"}`;
      const date = l.departDate ? String(l.departDate) : "—";
      return `${route} · ${date}`;
    });
  if (target.paxCount) {
    itineraryLines.push(`${target.paxCount} passenger${target.paxCount === 1 ? "" : "s"}`);
  }

  // A message row is stubbed in the thread BEFORE sending so the desk sees a
  // `queued` pill at once; it is then updated with the delivery outcome.
  const body = `Auto-generated status notification: ${args.newStatus}. ` + `See email content for member-facing copy.`;
  const previewBody = `Status → ${args.newStatus}`;

  // SMS only with explicit opt-in (comms_sms_updates defaults false — the
  // member never consented otherwise; TCPA-adjacent) and outside the
  // member's quiet hours. Email is the always-on channel.
  const sendSms =
    Boolean(target.memberPhone) && target.smsOptIn === true && !inQuietHours(target.quietStart, target.quietEnd, target.quietTz);

  // Email + SMS in parallel — each independently logged in messages so a
  // delivery failure of one doesn't lose the other.
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
    sendSms
      ? fireChannel({
          channel: "sms",
          toAddress: target.memberPhone!,
          send: async () => {
            // Dynamic on purpose: twilio is a `server-only` module.
            const { sendTripStatusSms } = await import("@/lib/twilio");
            return sendTripStatusSms({
              to: target.memberPhone!,
              tripCode: args.tripCode!,
              status: args.newStatus,
              firstLeg: itineraryLines[0] ?? null,
            });
          },
          previewBody,
          body,
          tripId: args.tripId,
          memberUserId: target.memberUserId,
          actorUserId: args.actorUserId,
        })
      : Promise.resolve({ status: "skipped" as const }),
  ]);

  // 'sent' on either channel counts as overall success for the audit row;
  // the per-channel detail is in the messages rows.
  if (emailOutcome.status === "sent" || smsOutcome.status === "sent") return { status: "sent" };
  if (emailOutcome.status === "failed" || smsOutcome.status === "failed") {
    return {
      status: "failed",
      error: emailOutcome.status === "failed" ? emailOutcome.error : (smsOutcome as { error?: string }).error,
    };
  }
  return { status: "skipped" };
}

/**
 * True when `now` falls inside the member's quiet-hours window. start/end
 * are Postgres `time` strings ("22:00:00"); the window may wrap midnight
 * (22:00 -> 07:00). Any parse/timezone failure returns false — quiet hours
 * must never silently eat an alert on bad data.
 */
export function inQuietHours(start: string | null, end: string | null, tz: string | null, now: Date = new Date()): boolean {
  if (!start || !end) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "America/Los_Angeles",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
    const hh = Number(parts.find((x) => x.type === "hour")?.value);
    const mm = Number(parts.find((x) => x.type === "minute")?.value);
    const cur = hh * 60 + mm;
    const toMin = (t: string) => {
      const [h, m] = t.split(":");
      return Number(h) * 60 + Number(m);
    };
    const s = toMin(start);
    const e = toMin(end);
    if ([cur, s, e].some(Number.isNaN)) return false;
    return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
  } catch {
    return false;
  }
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
  actorUserId: string | null;
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
  } catch (e) {
    console.error(`[trip-status:${args.channel}] message insert failed`, e);
    return { status: "failed", error: "DB_INSERT_FAILED" };
  }

  const result = await args.send();

  if (result.ok) {
    // Honest status: in logger mode nothing left the building — record
    // `queued`, not a false green `sent`.
    const delivered = result.provider !== "logger";
    await db
      .update(messages)
      .set({
        deliveryStatus: delivered ? "sent" : "queued",
        deliveryProvider: result.provider,
        deliveryMessageId: result.messageId ?? null,
        deliveryError: delivered ? null : "channel not configured — logged only, not delivered",
        deliveredAt: delivered ? new Date() : null,
      })
      .where(eq(messages.id, messageId));
    return { status: "sent" };
  }

  await db
    .update(messages)
    .set({ deliveryStatus: "failed", deliveryError: result.error.slice(0, 500) })
    .where(eq(messages.id, messageId));
  return { status: "failed", error: result.error };
}

/**
 * On a cancelled-trip transition, post equal-and-opposite refund rows to
 * the reserve ledger for every prior charter_draw against this trip, and
 * void the linked invoice(s) so /account/invoices and the reports stop
 * counting them as paid revenue.
 *
 * Policy: full refund of the drawn amount. Partial-keep / penalty scenarios
 * need an ops-side manual adjustment row on top — this baseline just
 * unwinds the automatic draw so the balance reflects the trip not
 * happening. Returns null when no draws existed.
 */
async function refundChartDrawsForTrip(args: {
  tripId: string;
  reason: "cancelled_wx" | "cancelled_other";
  tripCode: string | null;
  audit: AuditActor;
}): Promise<{ count: number; totalUsd: number } | null> {
  // Only draws that don't already have a matching refund: this filters out
  // both the cancel→confirm→cancel cycle (where a previous cancel already
  // posted refunds) and a partial racer. The partial unique index
  // `reserve_tx_refund_per_draw_uniq` (migration 0032) is the final
  // backstop against the concurrent-cancel race; the NOT EXISTS guard here
  // keeps it from throwing in the common single-writer case.
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
        sql`not exists (
          select 1 from ${reserveTransactions} r
          where r.trip_id = ${reserveTransactions.tripId}
            and r.invoice_id is not distinct from ${reserveTransactions.invoiceId}
            and r.kind = 'refund'
        )`,
      ),
    );

  if (draws.length === 0) return null;

  let totalUsd = 0;
  const refundedInvoiceIds = new Set<string>();
  try {
    await db.transaction(async (tx) => {
      for (const d of draws) {
        // charter_draws are stored as negative amounts; the refund is the
        // signed opposite (positive) so the balance returns to pre-flight.
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
        if (d.invoiceId) refundedInvoiceIds.add(d.invoiceId);
      }

      if (refundedInvoiceIds.size > 0) {
        await tx
          .update(invoices)
          .set({
            status: "void",
            notes: sql`coalesce(${invoices.notes} || E'\n', '') || ${`Voided on trip cancel (${args.reason})`}`,
            updatedAt: new Date(),
          })
          .where(inArray(invoices.id, Array.from(refundedInvoiceIds)));
      }
    });
  } catch (e) {
    // The partial unique index can fire when two cancellations race even
    // after the NOT EXISTS guard. The other writer has already posted the
    // refunds — fall through with null.
    if ((e as { code?: string }).code === "23505") {
      console.warn("[trip.cancel.refund] lost race to concurrent cancellation", { tripId: args.tripId, reason: args.reason });
      return null;
    }
    throw e;
  }

  await logAudit({
    actorUserId: args.audit.actorUserId,
    actorRole: "system",
    action: "trip.cancel.refund",
    subjectType: "trip",
    subjectId: args.tripId,
    subjectCode: args.tripCode,
    metadata: {
      ...args.audit.metadata,
      reason: args.reason,
      refundCount: draws.length,
      totalRefundedUsd: totalUsd,
      reserveTxIds: draws.map((d) => d.id),
    },
  });

  return { count: draws.length, totalUsd };
}

/**
 * Counterpart to refundChartDrawsForTrip for invoices paid by card through
 * Stripe. A refund failure never blocks the cancellation — it pages the
 * desk for a manual refund instead.
 */
async function refundCardPaymentsForTrip(args: {
  tripId: string;
  tripCode: string | null;
  audit: AuditActor;
}): Promise<{ refunded: number; failed: number; totalUsd: number } | null> {
  // Dynamic on purpose: stripe is a `server-only` module.
  const { isStripeConfigured, refundPaymentIntent } = await import("@/lib/stripe");
  if (!isStripeConfigured()) return null;

  const paidRows = await db
    .select({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      memberId: invoices.memberId,
      totalUsd: invoices.totalUsd,
      stripePaymentIntentId: invoices.stripePaymentIntentId,
    })
    .from(invoices)
    .where(and(eq(invoices.tripId, args.tripId), eq(invoices.status, "paid")));
  const refundable = paidRows.filter((r) => r.stripePaymentIntentId);
  if (refundable.length === 0) return null;

  let refunded = 0;
  let failed = 0;
  let totalUsd = 0;

  for (const inv of refundable) {
    const result = await refundPaymentIntent(inv.stripePaymentIntentId!);

    if (result.ok) {
      // Guard on status='paid' so a concurrent runner can't double-book the
      // ledger state; Stripe already refuses a duplicate full refund.
      await db
        .update(invoices)
        .set({ status: "void", updatedAt: new Date() })
        .where(and(eq(invoices.id, inv.id), eq(invoices.status, "paid")));
      refunded += 1;
      totalUsd += result.amountUsd ?? inv.totalUsd ?? 0;

      await logAudit({
        actorUserId: args.audit.actorUserId,
        actorRole: args.audit.actorRole,
        action: "invoice.refund.card",
        subjectType: "invoice",
        subjectId: inv.id,
        subjectCode: inv.invoiceCode,
        diff: { status: { before: "paid", after: "void" } },
        metadata: {
          ...args.audit.metadata,
          stripeRefundId: result.refundId,
          amountUsd: result.amountUsd ?? inv.totalUsd,
          tripCode: args.tripCode,
          trigger: "trip_cancellation",
        },
      });

      // Customer refund notice — best-effort.
      try {
        if (inv.memberId) {
          const [m] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(members)
            .innerJoin(users, eq(users.id, members.userId))
            .where(eq(members.id, inv.memberId));
          if (m?.email) {
            await sendRefundIssuedEmail({
              to: m.email,
              firstName: m.firstName || "Hello",
              invoiceCode: inv.invoiceCode,
              tripCode: args.tripCode,
              amountUsd: result.amountUsd ?? inv.totalUsd,
            });
          }
        }
      } catch (e) {
        console.error("refund email failed (non-fatal)", e);
      }
    } else {
      failed += 1;
      await logAudit({
        actorUserId: args.audit.actorUserId,
        actorRole: args.audit.actorRole,
        action: "invoice.refund.card_failed",
        subjectType: "invoice",
        subjectId: inv.id,
        subjectCode: inv.invoiceCode,
        metadata: {
          ...args.audit.metadata,
          error: result.error,
          stripePaymentIntentId: inv.stripePaymentIntentId,
          tripCode: args.tripCode,
        },
      });
      try {
        await sendDispatchAlert({
          subject: `Card refund failed on ${inv.invoiceCode} — refund it by hand`,
          headline: "A cancellation refund failed in Stripe.",
          lines: [
            `Invoice ${inv.invoiceCode}${args.tripCode ? ` (trip ${args.tripCode})` : ""} — ${result.error}.`,
            "Issue the refund manually in the Stripe dashboard; the invoice is still marked paid.",
          ],
          link: { label: "Open the trip sheet", url: `https://jetnine.com/admin/trips/${args.tripId}` },
        });
      } catch (e) {
        console.error("refund-failed alert failed (non-fatal)", e);
      }
    }
  }

  return { refunded, failed, totalUsd };
}

// ─── Invoice editor (draft → due) ────────────────────────────────────────
//
// convertRequestToTrip creates the invoice as `draft` (unless an immediate
// reserve drawdown flips it straight to `paid`); a draft has no
// member-facing Pay button until a dispatcher reviews the figures and
// finalizes it to `due`. Save keeps it a draft; Finalize moves it to due
// and emails the client. Editing is locked once the invoice leaves `draft`.

export const INVOICE_NOT_FOUND = "Invoice not found";

export type InvoiceUpdateState = {
  invoice: Invoice;
  /** The trip the invoice bills, when it has one. */
  trip: { id: string; code: string } | null;
};

/** The figures the row will carry after the update: a field left out keeps its value, null clears it. */
export function resolvedInvoiceFigures(input: InvoiceUpdateInput, state: InvoiceUpdateState) {
  const inv = state.invoice;
  const pick = (next: number | null | undefined, cur: number | null) => (next === undefined ? cur : next);
  return {
    subtotalUsd: pick(input.subtotalUsd, inv.subtotalUsd),
    fetUsd: pick(input.fetUsd, inv.fetUsd),
    segmentFeeUsd: pick(input.segmentFeeUsd, inv.segmentFeeUsd),
    totalUsd: pick(input.totalUsd, inv.totalUsd),
    notes: input.notes === undefined ? inv.notes : input.notes || null,
  };
}

export async function loadInvoiceForUpdate(input: InvoiceUpdateInput): Promise<Result<InvoiceUpdateState>> {
  if (!isUuid(input.id)) return err("not_found", INVOICE_NOT_FOUND);
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, input.id));
  if (!inv) return err("not_found", INVOICE_NOT_FOUND);
  if (inv.status !== "draft") return err("conflict", `Invoice is ${inv.status} — only drafts are editable`);

  let trip: InvoiceUpdateState["trip"] = null;
  if (inv.tripId) {
    const [t] = await db.select({ id: trips.id, code: trips.tripCode }).from(trips).where(eq(trips.id, inv.tripId));
    trip = t ?? null;
  }
  const state = { invoice: inv, trip };

  if (input.intent === "finalize") {
    const { totalUsd } = resolvedInvoiceFigures(input, state);
    if (totalUsd === null || totalUsd <= 0) return err("invalid", "Total must be greater than zero to finalize");
  }
  return ok(state);
}

/**
 * Write the figures (and due date) to a draft invoice; `finalize` also moves
 * it to due and tells the client. The update is constrained to
 * status='draft' so a concurrent finalize can't be double-applied.
 */
export async function updateInvoice(
  actor: Actor,
  input: InvoiceUpdateInput,
  state: InvoiceUpdateState,
): Promise<Result<{ id: string; status: "draft" | "due" }>> {
  const inv = state.invoice;
  const { intent } = input;
  const { subtotalUsd, fetUsd, segmentFeeUsd, totalUsd, notes } = resolvedInvoiceFigures(input, state);
  const dueOn = input.dueOn ?? null;
  const a = auditFields(actor);

  const patch: Partial<typeof invoices.$inferInsert> = {
    subtotalUsd,
    fetUsd,
    segmentFeeUsd,
    totalUsd,
    notes,
    updatedAt: new Date(),
  };
  if (dueOn !== null) patch.dueOn = dueOn;

  if (intent === "finalize") {
    patch.status = "due";
    // A due invoice should carry a due date; default to +7 days when the
    // dispatcher didn't set one and the row doesn't already have one.
    if (dueOn === null && !inv.dueOn) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 7);
      patch.dueOn = d.toISOString().slice(0, 10);
    }
  }

  // Constrain to status='draft' so a concurrent finalize can't be
  // double-applied; empty result means someone else moved it first.
  const updated = await db
    .update(invoices)
    .set(patch)
    .where(and(eq(invoices.id, inv.id), eq(invoices.status, "draft")))
    .returning({ id: invoices.id });

  if (updated.length === 0) return err("conflict", "Invoice changed under you — reload the sheet");

  const diff: Record<string, unknown> = {
    subtotalUsd: { before: inv.subtotalUsd, after: subtotalUsd },
    fetUsd: { before: inv.fetUsd, after: fetUsd },
    segmentFeeUsd: { before: inv.segmentFeeUsd, after: segmentFeeUsd },
    totalUsd: { before: inv.totalUsd, after: totalUsd },
  };
  if (intent === "finalize") {
    diff.status = { before: "draft", after: "due" };
  }

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: intent === "finalize" ? "invoice.finalize" : "invoice.draft.update",
    subjectType: "invoice",
    subjectId: inv.id,
    subjectCode: inv.invoiceCode,
    diff,
    metadata: { ...a.metadata, intent, dueOn: patch.dueOn ?? inv.dueOn ?? null },
  });

  // Finalizing puts money on the table — tell the member rather than let
  // them discover the invoice by browsing /account/invoices. Best-effort.
  if (intent === "finalize" && inv.memberId && totalUsd !== null) {
    try {
      const [m] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.id, inv.memberId));
      if (m?.email) {
        let tripCode: string | null = null;
        if (inv.tripId) {
          const [t] = await db.select({ tripCode: trips.tripCode }).from(trips).where(eq(trips.id, inv.tripId));
          tripCode = t?.tripCode ?? null;
        }
        await sendInvoiceIssuedEmail({
          to: m.email,
          firstName: m.firstName || "Hello",
          invoiceCode: inv.invoiceCode,
          tripCode,
          totalUsd,
          dueOn: (patch.dueOn ?? inv.dueOn ?? null) as string | null,
        });
      }
    } catch (e) {
      console.error("invoice-issued email failed (non-fatal)", e);
    }
  }

  return ok({ id: inv.id, status: intent === "finalize" ? "due" : "draft" });
}
