import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema/invoices";
import { trips, tripLegs } from "@/db/schema/trips";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { USD } from "@/lib/request-page";
import { InvoicesPayButton } from "@/components/account/invoices-pay-button";
import { BTN_PRIMARY, EmptyPanel, PANEL, PageHead, UnderLink } from "@/components/account/panel";

export const dynamic = "force-dynamic";

// ─── Plain-words helpers ─────────────────────────────────────────────────

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Aug 16" from a YYYY-MM-DD date (no timezone shift). */
function monthDay(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : MONTH_DAY.format(d);
}

/** Whole days from today (Los Angeles calendar) to a YYYY-MM-DD date. */
function daysUntil(date: string): number {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

type Tone = "bone" | "success" | "gold" | "danger" | "steel";
const TONE_CLASS: Record<Tone, string> = {
  bone: "text-bone",
  success: "text-success",
  gold: "text-gold",
  danger: "text-danger",
  steel: "text-steel",
};

/** Status as a sentence — never the enum word. */
function statusSentence(i: {
  status: string;
  kind: string;
  dueOn: string | null;
  paidOn: string | null;
}): { text: string; tone: Tone } {
  switch (i.status) {
    case "paid": {
      const day = monthDay(i.paidOn);
      return { text: day ? `Paid ${day}` : "Paid", tone: "success" };
    }
    case "due":
    case "overdue": {
      if (!i.dueOn) {
        return i.status === "overdue"
          ? { text: "Overdue", tone: "danger" }
          : { text: "Due now", tone: "bone" };
      }
      const n = daysUntil(i.dueOn);
      if (n < 0) {
        return { text: `Overdue by ${-n} ${-n === 1 ? "day" : "days"}`, tone: "danger" };
      }
      if (i.status === "overdue") return { text: "Overdue", tone: "danger" };
      if (n === 0) return { text: "Due today", tone: "gold" };
      if (n === 1) return { text: "Due tomorrow", tone: "gold" };
      return { text: `Due in ${n} days`, tone: "bone" };
    }
    case "credit":
      return { text: i.kind === "refund" ? "Refunded" : "Credited to your account", tone: "steel" };
    case "void":
      return { text: "Cancelled", tone: "steel" };
    case "draft":
    default:
      return { text: "Draft — nothing to pay yet", tone: "steel" };
  }
}

const KIND_LABEL: Record<string, string> = {
  charter: "Charter flight",
  credit: "Credit",
  refund: "Refund",
  top_up: "Top-up",
  renewal: "Membership renewal",
};

export default async function AccountInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  await requireUser("/account/invoices");
  const user = await getCurrentUser();
  if (!user) return null;

  const sp = await searchParams;
  const flash = sp.paid
    ? { kind: "paid" as const, invoiceId: sp.paid }
    : sp.cancelled
      ? { kind: "cancelled" as const, invoiceId: sp.cancelled }
      : null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <>
        <PageHead title="Invoices" sub="Nothing to bill yet. Invoices appear here once you have a flight on the books." />
        <Link href="/quote" className={`${BTN_PRIMARY} mt-[22px]`}>
          Request a quote <span aria-hidden="true">→</span>
        </Link>
      </>
    );
  }

  const rows = await db
    .select({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      kind: invoices.kind,
      status: invoices.status,
      issuedOn: invoices.issuedOn,
      dueOn: invoices.dueOn,
      paidOn: invoices.paidOn,
      subtotalUsd: invoices.subtotalUsd,
      fetUsd: invoices.fetUsd,
      segmentFeeUsd: invoices.segmentFeeUsd,
      totalUsd: invoices.totalUsd,
      tripId: invoices.tripId,
      tripCode: trips.tripCode,
    })
    .from(invoices)
    .leftJoin(trips, eq(trips.id, invoices.tripId))
    .where(eq(invoices.memberId, member.id))
    .orderBy(desc(invoices.issuedOn))
    .limit(50);

  // Route words for the invoices tied to a trip ("Los Angeles → Aspen"),
  // so the row never has to fall back to the trip code. Read-only, scoped
  // to the trips the member's own invoices already reference.
  const tripIds = Array.from(new Set(rows.map((r) => r.tripId).filter((id): id is string => !!id)));
  const routeByTrip = new Map<string, string>();
  if (tripIds.length > 0) {
    const legs = await db
      .select({
        tripId: tripLegs.tripId,
        legNumber: tripLegs.legNumber,
        fromCity: tripLegs.fromCity,
        fromIata: tripLegs.fromIata,
        toCity: tripLegs.toCity,
        toIata: tripLegs.toIata,
      })
      .from(tripLegs)
      .where(inArray(tripLegs.tripId, tripIds))
      .orderBy(asc(tripLegs.tripId), asc(tripLegs.legNumber));
    for (const leg of legs) {
      if (routeByTrip.has(leg.tripId)) continue;
      const from = leg.fromCity ?? leg.fromIata;
      const to = leg.toCity ?? leg.toIata;
      if (from && to) routeByTrip.set(leg.tripId, `${from} → ${to}`);
    }
  }

  const totals = {
    outstanding: rows
      .filter((r) => r.status === "due" || r.status === "overdue")
      .reduce((sum, r) => sum + (r.totalUsd ?? 0), 0),
    paid: rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + (r.totalUsd ?? 0), 0),
  };

  const outstanding = rows.filter((r) => r.status === "due" || r.status === "overdue");
  const paid = rows.filter((r) => r.status === "paid");
  const other = rows.filter((r) => !["due", "overdue", "paid"].includes(r.status));

  const summary =
    outstanding.length === 0
      ? "Nothing outstanding."
      : outstanding.length === 1
        ? `${USD.format(totals.outstanding)} due on one invoice.`
        : `${USD.format(totals.outstanding)} due across ${outstanding.length} invoices.`;

  const lastPaid = paid
    .filter((r) => r.paidOn)
    .sort((a, b) => String(b.paidOn).localeCompare(String(a.paidOn)))[0];
  const stats: [string, string][] = [
    ["Outstanding", USD.format(totals.outstanding)],
    ["Paid to date", USD.format(totals.paid)],
    [
      "Last payment",
      lastPaid ? [monthDay(lastPaid.paidOn), lastPaid.totalUsd != null ? USD.format(lastPaid.totalUsd) : null].filter(Boolean).join(" · ") : "—",
    ],
  ];

  return (
    <>
      <PageHead
        title="Invoices"
        sub={
          <>
            {summary}
            {totals.paid > 0 ? ` ${USD.format(totals.paid)} paid to date.` : ""} Every receipt in one place.
          </>
        }
      />

      {flash ? (
        <div
          role="status"
          className={[
            PANEL,
            "mt-[22px] px-6 py-4 text-[15px] leading-[1.5] text-bone",
            flash.kind === "paid" ? "!border-gold" : "",
          ].join(" ")}
        >
          {flash.kind === "paid"
            ? "Payment received — thank you. Stripe's confirmation is on its way to your inbox, and this list updates once the payment clears, usually within a few seconds."
            : "Checkout cancelled. Your invoice is still open — pay whenever you're ready."}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyPanel title="No invoices yet.">
          Invoices land here automatically once a quote you accept becomes a trip.
        </EmptyPanel>
      ) : (
        <>
          <dl className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
            {stats.map(([k, v]) => (
              <div key={k} className={`${PANEL} px-4 py-3.5`}>
                <dt className="text-[12px] text-steel">{k}</dt>
                <dd className="mt-0.5 font-serif text-[26px] leading-[1.2] text-bone">{v}</dd>
              </div>
            ))}
          </dl>
          <InvoiceGroup
            label="Outstanding"
            empty="Nothing outstanding."
            rows={outstanding}
            routeByTrip={routeByTrip}
            payable
          />
          <InvoiceGroup label="Paid" empty="Nothing paid yet." rows={paid} routeByTrip={routeByTrip} />
          {other.length > 0 ? (
            <InvoiceGroup label="Credits and drafts" empty="" rows={other} routeByTrip={routeByTrip} />
          ) : null}
        </>
      )}

      <section className={`${PANEL} mt-5 px-5 py-[18px]`}>
        <h2 className="font-serif text-[20px] font-normal text-bone">Paying online</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-bone">
          Every total already includes the 7.5% federal excise tax and the $5.20 per-passenger segment
          fee.
        </p>
        <p className="mt-2 text-[12px] text-steel">
          Card payments open in Stripe Checkout. JetNine never sees or stores your full card number. To pay by
          wire, call dispatch.
        </p>
      </section>
    </>
  );
}

type Row = {
  id: string;
  invoiceCode: string;
  kind: string;
  status: string;
  issuedOn: string;
  dueOn: string | null;
  paidOn: string | null;
  fetUsd: number | null;
  segmentFeeUsd: number | null;
  totalUsd: number | null;
  tripId: string | null;
};

function InvoiceGroup({
  label,
  empty,
  rows,
  routeByTrip,
  payable = false,
}: {
  label: string;
  empty: string;
  rows: Row[];
  routeByTrip: Map<string, string>;
  payable?: boolean;
}) {
  return (
    <section className="mt-6">
      <h2 className="font-serif text-[24px] font-normal text-bone">
        {label}
        {rows.length > 0 ? <span className="font-sans text-[14px] text-steel"> · {rows.length}</span> : null}
      </h2>
      {rows.length === 0 ? (
        <div className={`${PANEL} mt-2.5 px-[18px] py-4 text-[14px] text-steel`}>{empty}</div>
      ) : (
        <div className={`${PANEL} mt-2.5 text-[14px]`}>
          <div
            aria-hidden="true"
            className="flex flex-wrap gap-4 bg-surface-2 px-[18px] py-2.5 text-[12px] font-bold text-bone max-md:hidden"
          >
            <span className="min-w-0 flex-[999_1_200px]">Flight</span>
            <span className="min-w-0 flex-[999_1_120px]">Issued</span>
            <span className="min-w-0 flex-[999_1_140px]">Status</span>
            <span className="min-w-0 flex-[999_1_100px]">Amount</span>
            <span className="min-w-[120px] flex-none text-right">{payable ? "Pay" : ""}</span>
          </div>
          <ul>
            {rows.map((i) => {
              const status = statusSentence(i);
              const route = i.tripId ? routeByTrip.get(i.tripId) : undefined;
              const title = route ?? KIND_LABEL[i.kind] ?? "Invoice";
              const fees: string[] = [];
              if (i.fetUsd) fees.push(`${USD.format(i.fetUsd)} federal excise tax`);
              if (i.segmentFeeUsd) fees.push(`${USD.format(i.segmentFeeUsd)} segment fee`);
              const issued = monthDay(i.issuedOn);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-[18px] py-3 first:border-t-0 md:first:border-t">
                  <div className="min-w-0 flex-[999_1_200px]">
                    <div className="font-serif text-[17px] text-bone">
                      {i.tripId ? (
                        <Link href={`/account/trips/${i.tripId}`} className="transition-colors hover:text-gold">
                          {title}
                        </Link>
                      ) : (
                        title
                      )}
                    </div>
                    <div className="text-[12px] leading-[1.5] text-steel">
                      {i.invoiceCode}
                      {fees.length ? ` · includes ${fees.join(" and ")}` : ""}
                    </div>
                  </div>
                  <span className="min-w-0 flex-[999_1_120px] text-steel">{issued ? `Issued ${issued}` : "Issued"}</span>
                  <span className={["min-w-0 flex-[999_1_140px]", TONE_CLASS[status.tone]].join(" ")}>{status.text}</span>
                  <span className="min-w-0 flex-[999_1_100px] font-serif text-[19px] text-bone">
                    {i.totalUsd != null ? USD.format(i.totalUsd) : "—"}
                  </span>
                  <div className="flex min-w-[120px] max-w-full flex-none justify-end max-md:w-full max-md:justify-start">
                    {payable && (i.status === "due" || i.status === "overdue") ? (
                      <InvoicesPayButton invoiceId={i.id} />
                    ) : i.tripId ? (
                      <UnderLink href={`/account/trips/${i.tripId}`}>Trip details</UnderLink>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
