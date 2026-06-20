import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { messages } from "@/db/schema/audit";
import { trips } from "@/db/schema/trips";
import { formatUSD } from "@/lib/quote-pricing";
import {
  FailedDeliveryList,
  type FailedDeliveryRow,
} from "@/components/admin/failed-delivery-list";

export const dynamic = "force-dynamic";

type LegRow = typeof quoteLegs.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;

// Statuses where the first-reply SLA no longer applies — the quote is
// resolved or closed, so a live countdown is noise (and was ticking on
// cancelled quotes). Render a neutral dash instead.
const SLA_SETTLED = new Set(["accepted", "declined", "expired", "cancelled", "converted"]);

function slaBucket(
  deadline: Date | null,
  status: string,
): { label: string; tone: "ok" | "warn" | "crit" | "lock" } {
  if (SLA_SETTLED.has(status)) return { label: "—", tone: "lock" };
  if (!deadline) return { label: "—", tone: "ok" };
  const msLeft = deadline.getTime() - Date.now();
  const minutes = Math.round(msLeft / 60_000);
  if (minutes < 0) return { label: `${Math.abs(minutes)}m past`, tone: "lock" };
  if (minutes < 5) return { label: `${minutes}m left`, tone: "crit" };
  if (minutes < 20) return { label: `${minutes}m left`, tone: "warn" };
  return { label: `${minutes}m left`, tone: "ok" };
}

const TONE_CLASS: Record<"ok" | "warn" | "crit" | "lock", string> = {
  ok: "text-clearance",
  warn: "text-[var(--warn)]",
  crit: "text-[var(--error)]",
  lock: "text-steel",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "border-ink-3 text-bone-2",
  submitted: "border-clearance text-clearance",
  triaged: "border-bone-2 text-bone",
  sourcing: "border-[var(--warn)] text-[var(--warn)]",
  options_sent: "border-bone text-bone",
  held: "border-ink-4 text-steel",
  accepted: "border-[var(--success)] text-[var(--success)]",
  declined: "border-[var(--error)] text-[var(--error)]",
  expired: "border-steel text-steel",
  cancelled: "border-steel text-steel",
  converted: "border-[var(--success)] text-[var(--success)]",
};

export default async function DispatchInboxPage() {
  // All quotes most-recent first. In production this'd paginate; for now
  // we cap to the latest 100 so the page stays fast under load.
  const rows = await db
    .select()
    .from(quotes)
    .orderBy(desc(quotes.receivedAt))
    .limit(100);

  // Pull all legs for these quotes in one shot to avoid an N+1.
  const ids = rows.map((r) => r.id);
  const legs: LegRow[] = ids.length
    ? await db.select().from(quoteLegs).where(orInArray(quoteLegs.quoteId, ids))
    : [];

  const legsByQuote = new Map<string, LegRow[]>();
  for (const l of legs) {
    const arr = legsByQuote.get(l.quoteId) ?? [];
    arr.push(l);
    legsByQuote.set(l.quoteId, arr);
  }

  const stats = computeStats(rows);

  // Failed-delivery surface — last 7 days of outbound email messages
  // stuck in `delivery_status='failed'`. Joins quote/trip to surface
  // the entity code for the row, since the messages table is polymorphic.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const failedRaw = await db
    .select({
      id: messages.id,
      subjectType: messages.subjectType,
      subjectId: messages.subjectId,
      toAddress: messages.toAddress,
      preview: messages.preview,
      error: messages.deliveryError,
      occurredAt: messages.occurredAt,
      quoteCode: quotes.quoteCode,
      tripCode: trips.tripCode,
    })
    .from(messages)
    .leftJoin(quotes, and(eq(messages.subjectType, "quote"), eq(quotes.id, messages.subjectId)))
    .leftJoin(trips, and(eq(messages.subjectType, "trip"), eq(trips.id, messages.subjectId)))
    .where(
      and(
        eq(messages.deliveryStatus, "failed"),
        eq(messages.direction, "out"),
        gte(messages.occurredAt, sevenDaysAgo),
      ),
    )
    .orderBy(desc(messages.occurredAt))
    .limit(50);

  const failedDeliveries: FailedDeliveryRow[] = failedRaw
    .filter((r) => r.subjectType === "quote" || r.subjectType === "trip")
    .map((r) => ({
      id: r.id,
      subjectType: r.subjectType as "quote" | "trip",
      subjectId: r.subjectId,
      subjectCode: r.quoteCode ?? r.tripCode ?? null,
      toAddress: r.toAddress,
      preview: r.preview,
      error: r.error,
      occurredAt: r.occurredAt,
    }));

  return (
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Dispatch · inbox</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            Quotes waiting to be worked.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Submitted within the last week, newest first. Click a row to open the quote workbench.
            SLA timers tick on every load.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["TOTAL", String(rows.length)],
            ["NEW", String(stats.submitted)],
            ["SOURCING", String(stats.sourcing)],
            ["PAST SLA", String(stats.pastSla)],
          ].map(([lbl, val]) => (
            <div key={lbl} className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{lbl}</dt>
              <dd
                className={[
                  "mt-1 font-serif text-[26px] font-light leading-none",
                  lbl === "PAST SLA" && stats.pastSla > 0 ? "text-[var(--error)]" : "text-bone",
                ].join(" ")}
              >
                {val}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Inbox empty</p>
          <h2 className="font-serif text-[24px] font-normal text-bone">No quotes yet today.</h2>
          <p className="mx-auto mt-3 max-w-[44ch] text-[14px] leading-[1.55] text-bone-2">
            When a client completes the /quote wizard, the request lands here with a 30-minute
            SLA timer attached.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink-3">
                {["Ref", "Route", "Pax", "Category", "Contact", "Received", "SLA", "Status", ""].map((h) => (
                  <th
                    key={h || Math.random()}
                    className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <Row key={q.id} q={q} legs={legsByQuote.get(q.id) ?? []} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-14">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="caption mb-2">— Failed deliveries · last 7 days</p>
            <h2 className="font-serif text-[22px] font-light leading-tight tracking-tight text-bone">
              Mail that didn&rsquo;t leave the building.
            </h2>
            <p className="mt-2 max-w-[60ch] text-[13px] leading-[1.55] text-bone-2">
              Thread emails the provider rejected. Retry sends the same body again
              against the same recipient; a still-failing retry updates the error
              text but doesn&rsquo;t double-deliver.
            </p>
          </div>
          {failedDeliveries.length > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--error)]">
              {failedDeliveries.length} stuck
            </span>
          ) : null}
        </header>
        <FailedDeliveryList initial={failedDeliveries} />
      </section>
    </div>
  );
}

function Row({ q, legs }: { q: QuoteRow; legs: LegRow[] }) {
  const sla = slaBucket(q.slaDeadlineAt, q.status);
  const route = legs.length
    ? legs
        .sort((a, b) => a.legNumber - b.legNumber)
        .map((l) => `${l.fromIata ?? "—"}→${l.toIata ?? "—"}`)
        .join(" · ")
    : "—";
  const contactName =
    q.contactSnapshot && (q.contactSnapshot.firstName || q.contactSnapshot.lastName)
      ? `${q.contactSnapshot.firstName ?? ""} ${q.contactSnapshot.lastName ?? ""}`.trim()
      : "Anonymous";
  const indicative =
    q.indicativeLowUsd && q.indicativeHighUsd
      ? `${formatUSD(q.indicativeLowUsd)} – ${formatUSD(q.indicativeHighUsd)}`
      : null;

  return (
    <tr className="border-b border-ink-3 transition-colors hover:bg-ink">
      <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-clearance">
        {q.quoteCode}
      </td>
      <td className="px-5 py-5">
        <div className="font-mono text-[11px] tracking-[0.04em] text-bone">{route}</div>
        {indicative ? (
          <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">{indicative}</div>
        ) : null}
      </td>
      <td className="px-5 py-5 font-mono text-[12px] tracking-[0.04em] text-bone">{q.paxCount}</td>
      <td className="px-5 py-5 font-mono text-[11px] uppercase tracking-[0.06em] text-bone-2">
        {q.requestedCategory ?? "—"}
      </td>
      <td className="px-5 py-5">
        <div className="text-[13px] text-bone">{contactName}</div>
        {q.contactSnapshot?.email ? (
          <div className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
            {q.contactSnapshot.email}
          </div>
        ) : null}
      </td>
      <td className="px-5 py-5 font-mono text-[10px] tracking-[0.04em] text-bone-2">
        {q.receivedAt ? relativeTime(q.receivedAt) : "—"}
      </td>
      <td className={`px-5 py-5 font-mono text-[11px] tracking-[0.04em] ${TONE_CLASS[sla.tone]}`}>
        {sla.label}
      </td>
      <td className="px-5 py-5">
        <span
          className={[
            "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
            STATUS_CLASS[q.status] ?? "border-ink-3 text-bone-2",
          ].join(" ")}
        >
          {q.status}
        </span>
      </td>
      <td className="px-5 py-5 text-right">
        <Link
          href={`/admin/quote/${q.id}`}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
        >
          Open →
        </Link>
      </td>
    </tr>
  );
}

function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function computeStats(rows: QuoteRow[]) {
  let submitted = 0;
  let sourcing = 0;
  let pastSla = 0;
  for (const r of rows) {
    if (r.status === "submitted") submitted++;
    if (r.status === "sourcing" || r.status === "triaged") sourcing++;
    if (
      r.slaDeadlineAt &&
      r.slaDeadlineAt.getTime() < Date.now() &&
      ["submitted", "triaged", "sourcing"].includes(r.status)
    ) {
      pastSla++;
    }
  }
  return { submitted, sourcing, pastSla };
}

// Drizzle helper — inArray re-export is verbose to type at the call site.
import { inArray } from "drizzle-orm";
import type { Column } from "drizzle-orm";
function orInArray<T>(col: Column, vals: T[]) {
  return inArray(col, vals as unknown as string[]);
}
