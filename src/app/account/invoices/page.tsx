import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema/invoices";
import { trips } from "@/db/schema/trips";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { formatUSD } from "@/lib/quote-pricing";
import { PayInvoiceButton } from "@/components/invoice/pay-button";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  draft: "border-bone-2 text-bone-2",
  due: "border-[var(--warn)] text-[var(--warn)]",
  overdue: "border-[var(--error)] text-[var(--error)]",
  paid: "border-[var(--success)] text-[var(--success)]",
  credit: "border-clearance text-clearance",
  void: "border-steel text-steel",
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
      <section className="container-jn py-12">
        <p className="caption mb-4">— Account · invoices</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          Nothing to bill yet.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.55] text-bone-2">
          Invoices appear here once you have a flight on the books. Submit a quote at{" "}
          <Link href="/quote" className="text-clearance">/quote</Link> to get the loop started.
        </p>
      </section>
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

  const totals = {
    outstanding: rows
      .filter((r) => r.status === "due" || r.status === "overdue")
      .reduce((sum, r) => sum + (r.totalUsd ?? 0), 0),
    paid: rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + (r.totalUsd ?? 0), 0),
  };

  return (
    <section className="container-jn py-12">
      {flash ? (
        <div
          className={[
            "mb-8 rounded-[3px] border px-5 py-4 font-mono text-[12px] tracking-[0.04em]",
            flash.kind === "paid"
              ? "border-[var(--success)] bg-[rgba(78,159,107,0.08)] text-[var(--success)]"
              : "border-[var(--warn)] bg-[rgba(192,148,73,0.08)] text-[var(--warn)]",
          ].join(" ")}
        >
          {flash.kind === "paid"
            ? "— Payment received. Stripe confirmation lands in your inbox; this list updates once the webhook clears (usually a few seconds)."
            : "— Checkout cancelled. Your invoice is still open — try again whenever you're ready."}
        </div>
      ) : null}
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Account · invoices</p>
          <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
            Invoices · {rows.length}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            All invoices tied to your account. FET (7.5%) + IRS segment fee ($5.20 × pax × legs)
            already itemized.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          <div className="flex flex-col items-end">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              OUTSTANDING
            </dt>
            <dd
              className={[
                "mt-1 font-serif text-[26px] font-light leading-none",
                totals.outstanding > 0 ? "text-[var(--warn)]" : "text-bone",
              ].join(" ")}
            >
              {totals.outstanding ? formatUSD(totals.outstanding) : "$0"}
            </dd>
          </div>
          <div className="flex flex-col items-end">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">PAID</dt>
            <dd className="mt-1 font-serif text-[26px] font-light leading-none text-bone">
              {totals.paid ? formatUSD(totals.paid) : "$0"}
            </dd>
          </div>
        </dl>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Empty</p>
          <h2 className="font-serif text-[24px] font-normal text-bone">No invoices yet.</h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-[14px] leading-[1.55] text-bone-2">
            Invoices land here automatically once a quote you accept is converted to a trip.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((i) => (
            <li
              key={i.id}
              className="flex flex-col gap-3 rounded-[4px] border border-ink-3 bg-ink-2 px-6 py-5 md:grid md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center md:gap-6"
            >
              <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                {i.invoiceCode}
              </span>
              <div>
                <div className="font-serif text-[17px] font-normal leading-tight text-bone">
                  {i.tripCode ? (
                    <Link
                      href={`/account/trips/${i.tripId}`}
                      className="transition-colors hover:text-clearance"
                    >
                      Trip {i.tripCode}
                    </Link>
                  ) : (
                    i.kind[0].toUpperCase() + i.kind.slice(1)
                  )}
                </div>
                <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                  Issued {String(i.issuedOn)}
                  {i.dueOn ? ` · due ${String(i.dueOn)}` : ""}
                  {i.paidOn ? ` · paid ${String(i.paidOn)}` : ""}
                </div>
              </div>
              <span
                className={[
                  "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                  STATUS_CLASS[i.status] ?? "border-ink-3 text-bone-2",
                ].join(" ")}
              >
                {i.status}
              </span>
              <div className="text-right">
                <div className="font-mono text-[10px] tracking-[0.04em] text-steel">
                  + FET {i.fetUsd ? formatUSD(i.fetUsd) : "—"}
                </div>
                <div className="font-mono text-[10px] tracking-[0.04em] text-steel">
                  + Seg {i.segmentFeeUsd ? formatUSD(i.segmentFeeUsd) : "—"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div
                  className="font-serif text-[22px] font-light leading-none tracking-tight text-bone"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {i.totalUsd ? formatUSD(i.totalUsd) : "—"}
                </div>
                {i.status === "due" || i.status === "overdue" ? (
                  <PayInvoiceButton invoiceId={i.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
