import Link from "next/link";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

// Client-facing wording for the internal status machine — a member shouldn't
// have to decode "triaged"/"sourcing" desk jargon.
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Received",
  triaged: "With dispatch",
  sourcing: "Sourcing aircraft",
  options_sent: "Options sent",
  held: "Aircraft on hold",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
  converted: "Booked",
};

const STATUS_CLASS: Record<string, string> = {
  submitted: "border-clearance text-clearance",
  triaged: "border-bone-2 text-bone",
  sourcing: "border-[var(--warn)] text-[var(--warn)]",
  options_sent: "border-bone text-bone",
  held: "border-clearance text-clearance",
  accepted: "border-[var(--success)] text-[var(--success)]",
  converted: "border-[var(--success)] text-[var(--success)]",
  declined: "border-[var(--error)] text-[var(--error)]",
  expired: "border-steel text-steel",
  cancelled: "border-steel text-steel",
};

export default async function AccountQuotesPage() {
  await requireUser("/account/quotes");
  const user = await getCurrentUser();
  if (!user) return null;

  // Quotes are linked to the member row when one exists, and to the auth user
  // when a signed-in visitor submits before dispatch creates their member
  // profile — cover both.
  const member = await getMemberByUserId(user.id);
  const ownership = member
    ? or(eq(quotes.createdByUserId, user.id), eq(quotes.memberId, member.id))
    : eq(quotes.createdByUserId, user.id);

  const rows = await db
    .select({
      id: quotes.id,
      quoteCode: quotes.quoteCode,
      status: quotes.status,
      paxCount: quotes.paxCount,
      requestedCategory: quotes.requestedCategory,
      receivedAt: quotes.receivedAt,
      indicativeLowUsd: quotes.indicativeLowUsd,
      indicativeHighUsd: quotes.indicativeHighUsd,
    })
    .from(quotes)
    .where(ownership)
    .orderBy(desc(quotes.receivedAt))
    .limit(50);

  const ids = rows.map((r) => r.id);
  const legs = ids.length
    ? await db
        .select({
          quoteId: quoteLegs.quoteId,
          legNumber: quoteLegs.legNumber,
          fromIata: quoteLegs.fromIata,
          toIata: quoteLegs.toIata,
          departDate: quoteLegs.departDate,
        })
        .from(quoteLegs)
        .where(inArray(quoteLegs.quoteId, ids))
        .orderBy(asc(quoteLegs.legNumber))
    : [];
  const legsByQuote = new Map<string, typeof legs>();
  for (const l of legs) {
    const arr = legsByQuote.get(l.quoteId) ?? [];
    arr.push(l);
    legsByQuote.set(l.quoteId, arr);
  }

  return (
    <section className="container-jn py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Account · quotes</p>
          <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
            Your quotes · {rows.length}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Every request you&rsquo;ve submitted, newest first. Dispatch replies within 30 minutes
            during operating hours — options arrive by email (and this page tracks the status).
          </p>
        </div>
        <Link href="/quote/mission" className="btn btn-secondary btn-sm">
          Start a new quote <span className="arrow">→</span>
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Empty</p>
          <h2 className="font-serif text-[24px] font-normal text-bone">No quotes yet.</h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-[14px] leading-[1.55] text-bone-2">
            Start with the four-step wizard — route, timing, aircraft preferences — and a senior
            dispatcher takes it from there.
          </p>
          <Link href="/quote/mission" className="btn btn-primary btn-sm mt-6">
            Request a quote <span className="arrow">→</span>
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {rows.map((q) => {
            const qLegs = legsByQuote.get(q.id) ?? [];
            const route =
              qLegs.map((l) => `${l.fromIata ?? "—"} → ${l.toIata ?? "—"}`).join("  ·  ") || "—";
            const firstDate = qLegs[0]?.departDate ?? null;
            const indicative =
              q.indicativeLowUsd && q.indicativeHighUsd
                ? `${formatUSD(q.indicativeLowUsd)} – ${formatUSD(q.indicativeHighUsd)}`
                : null;
            return (
              <li
                key={q.id}
                className="flex flex-col gap-3 rounded-[4px] border border-ink-3 bg-ink-2 px-6 py-5 md:grid md:grid-cols-[auto_1fr_auto_auto] md:items-center md:gap-6"
              >
                <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                  {q.quoteCode}
                </span>
                <div>
                  <div className="font-serif text-[18px] font-normal leading-tight text-bone">
                    {route}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {firstDate ?? "date TBD"} · {q.paxCount} pax
                    {q.requestedCategory ? ` · ${q.requestedCategory}` : ""}
                  </div>
                </div>
                <span
                  className={[
                    "inline-block w-fit rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                    STATUS_CLASS[q.status] ?? "border-ink-3 text-bone-2",
                  ].join(" ")}
                >
                  {STATUS_LABEL[q.status] ?? q.status.replace(/_/g, " ")}
                </span>
                <div className="md:text-right">
                  <div className="font-mono text-[12px] tracking-[0.04em] text-bone">
                    {indicative ?? "Pricing with dispatch"}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {q.receivedAt ? q.receivedAt.toISOString().slice(0, 10) : "—"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
        — Need to change or cancel a request? Call dispatch — the desk answers 24/7.
      </p>
    </section>
  );
}
