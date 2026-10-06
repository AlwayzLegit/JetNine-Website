import { NewEmptyLegForm } from "./new-leg-form";
import { EmptyLegStatusSelect } from "@/components/admin/empty-leg-status-select";
import { formatUSD } from "@/lib/quote-pricing";
import { DeskCard, DeskEmpty, DeskHeader, DeskPage, NumberCard } from "@/components/admin/desk-ui";
import { listAvailableAircraft, listEmptyLegs } from "@/domain/empty-legs/queries";

export const dynamic = "force-dynamic";

const WHEELS_UP_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function AdminEmptyLegPage() {
  const [tails, { legs: rows, totals }] = await Promise.all([listAvailableAircraft(), listEmptyLegs()]);

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/settings/reference", label: "Reference data" }}
        title="Empty legs"
        lead={
          <>
            Publish a repositioning leg. The public board at{" "}
            <a href="/empty-legs" className="text-link" target="_blank" rel="noopener noreferrer">
              /empty-legs
            </a>{" "}
            reads the same table — set a leg live and it appears on the next page load; the reference code is
            generated automatically.
          </>
        }
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NumberCard label="Live" value={totals.live} />
        <NumberCard label="Scheduled" value={totals.scheduled} />
        <NumberCard label="Draft" value={totals.draft} />
        <NumberCard label="Sold" value={totals.sold} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* New leg form */}
        <DeskCard title="New empty leg" className="p-6">
          <div className="mt-5">
            <NewEmptyLegForm tails={tails} />
          </div>
        </DeskCard>

        {/* Recent list */}
        <section>
          <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.2em] text-gold">
            Recent <span className="text-steel-dim">· {rows.length}</span>
          </h2>
          {rows.length === 0 ? (
            <DeskEmpty
              className="mt-0"
              title="Nothing published yet."
              body="Fill in the form to send the first leg to the board."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((l) => (
                <li key={l.id} className="card bg-panel px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-steel">Reference {l.code}</span>
                    <EmptyLegStatusSelect legId={l.id} current={l.status} />
                  </div>
                  <div className="mt-2 text-[19px] font-medium leading-tight text-bone">
                    {l.fromIata ?? l.fromIcao} <span className="text-steel">→</span> {l.toIata ?? l.toIcao}
                  </div>
                  <div className="mt-1 text-[14px] text-bone-2">
                    {WHEELS_UP_FMT.format(l.wheelsUpAt)} UTC · {l.seatsAvailable} seat
                    {l.seatsAvailable === 1 ? "" : "s"} · {l.operatorName}
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-[14px] text-success">
                      {l.discountPct !== null && l.discountPct !== undefined ? `${l.discountPct}% off` : "—"}
                    </span>
                    <span className="font-serif text-[22px] font-light leading-none text-bone">
                      {formatUSD(l.listedPriceUsd)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DeskPage>
  );
}
