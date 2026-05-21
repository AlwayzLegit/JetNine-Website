import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { emptyLegs } from "@/db/schema/empty-legs";
import { NewEmptyLegForm } from "./new-leg-form";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  draft: "border-ink-3 text-bone-2",
  scheduled: "border-bone-2 text-bone-2",
  live: "border-clearance text-clearance",
  sold: "border-[var(--success)] text-[var(--success)]",
  cancelled: "border-[var(--error)] text-[var(--error)]",
  expired: "border-steel text-steel",
};

export default async function AdminEmptyLegPage() {
  const tails = await db
    .select({
      tail: aircraft.tailNumber,
      makeModel: aircraft.makeModel,
      operator: operators.name,
    })
    .from(aircraft)
    .innerJoin(operators, eq(operators.id, aircraft.operatorId))
    .where(eq(aircraft.status, "available"))
    .orderBy(asc(operators.name), asc(aircraft.tailNumber));

  const rows = await db
    .select({
      id: emptyLegs.id,
      code: emptyLegs.code,
      status: emptyLegs.status,
      fromIata: emptyLegs.fromIata,
      fromIcao: emptyLegs.fromIcao,
      toIata: emptyLegs.toIata,
      toIcao: emptyLegs.toIcao,
      wheelsUpAt: emptyLegs.wheelsUpAt,
      seatsAvailable: emptyLegs.seatsAvailable,
      listedPriceUsd: emptyLegs.listedPriceUsd,
      discountPct: emptyLegs.discountPct,
      operatorName: operators.name,
    })
    .from(emptyLegs)
    .innerJoin(operators, eq(operators.id, emptyLegs.operatorId))
    .orderBy(desc(emptyLegs.wheelsUpAt))
    .limit(50);

  const totals = {
    live: rows.filter((r) => r.status === "live").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    draft: rows.filter((r) => r.status === "draft").length,
    sold: rows.filter((r) => r.status === "sold").length,
  };

  return (
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Admin · empty legs</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            Publish a repositioning leg.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Public board reads <code className="text-clearance">/empty-legs</code> from the same
            table — go live and it appears on the next page load. Code generated automatically.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["LIVE", String(totals.live)],
            ["SCHEDULED", String(totals.scheduled)],
            ["DRAFT", String(totals.draft)],
            ["SOLD", String(totals.sold)],
          ].map(([lbl, val]) => (
            <div key={lbl} className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{lbl}</dt>
              <dd className="mt-1 font-serif text-[26px] font-light leading-none text-bone">
                {val}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_1fr]">
        {/* New leg form */}
        <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
          <h2 className="caption mb-6">— New empty leg</h2>
          <NewEmptyLegForm tails={tails} />
        </section>

        {/* Recent list */}
        <section>
          <h2 className="caption mb-4">— Recent · {rows.length}</h2>
          {rows.length === 0 ? (
            <p className="rounded-[4px] border border-ink-3 bg-ink-2 p-6 text-[14px] leading-[1.55] text-bone-2">
              Nothing published yet. Fill the form to send the first leg to the board.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((l) => (
                <li
                  key={l.id}
                  className="rounded-[4px] border border-ink-3 bg-ink-2 px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                      {l.code}
                    </span>
                    <span
                      className={[
                        "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        STATUS_CLASS[l.status] ?? "border-ink-3 text-bone-2",
                      ].join(" ")}
                    >
                      {l.status}
                    </span>
                  </div>
                  <div className="mt-2 font-serif text-[18px] leading-tight text-bone">
                    {l.fromIata ?? l.fromIcao} <span className="text-steel">→</span>{" "}
                    {l.toIata ?? l.toIcao}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {l.wheelsUpAt.toISOString().slice(0, 16).replace("T", " ")} · {l.seatsAvailable} seats · {l.operatorName}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                      {l.discountPct ?? "—"}% off
                    </span>
                    <span className="font-serif text-[20px] font-light leading-none text-bone">
                      {formatUSD(l.listedPriceUsd)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
