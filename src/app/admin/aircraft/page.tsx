import Link from "next/link";
import { asc, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { AircraftForm } from "@/components/admin/aircraft-form";
import { SOURCING_INELIGIBLE_STATUSES } from "@/lib/operator-eligibility";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  available: "border-[var(--success)] text-[var(--success)]",
  aog: "border-[var(--error)] text-[var(--error)]",
  maint: "border-[var(--warn)] text-[var(--warn)]",
  sold: "border-steel text-steel",
};

const CATEGORY_LABEL: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light",
  midsize: "Midsize",
  supermid: "Super-mid",
  heavy: "Heavy",
  ulr: "Ultra",
};

const WIFI_LABEL: Record<string, string> = {
  ka: "Ka-band",
  yes: "Wi-Fi",
  gogo: "Gogo",
  aircell: "Aircell",
  none: "—",
};

export default async function AdminAircraftPage() {
  const rows = await db
    .select({
      id: aircraft.id,
      tailNumber: aircraft.tailNumber,
      operatorId: aircraft.operatorId,
      operatorName: operators.name,
      category: aircraft.category,
      makeModel: aircraft.makeModel,
      yearManufactured: aircraft.yearManufactured,
      seats: aircraft.seats,
      rangeNm: aircraft.rangeNm,
      speedKt: aircraft.speedKt,
      wifiType: aircraft.wifiType,
      standupCabin: aircraft.standupCabin,
      lieflatCapable: aircraft.lieflatCapable,
      petFriendly: aircraft.petFriendly,
      baseIcao: aircraft.baseIcao,
      totalHours: aircraft.totalHours,
      status: aircraft.status,
    })
    .from(aircraft)
    .innerJoin(operators, eq(operators.id, aircraft.operatorId))
    .orderBy(asc(aircraft.category), asc(aircraft.tailNumber));

  const byCategory = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }

  // Operator options for the create form — exclude sourcing-ineligible
  // operators (suspended / banned / hold) via the shared safety-floor list.
  const operatorOptions = await db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .where(notInArray(operators.status, [...SOURCING_INELIGIBLE_STATUSES]))
    .orderBy(asc(operators.name));

  const totals = {
    total: rows.length,
    available: rows.filter((r) => r.status === "available").length,
    aog: rows.filter((r) => r.status === "aog").length,
    maint: rows.filter((r) => r.status === "maint").length,
  };

  return (
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Admin · aircraft</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            Fleet across the network · {totals.total} tails.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-bone-2">
            Grouped by category. Tail numbers are unique; each links back to its operator. The
            14-day availability planner is live at{" "}
            <Link href="/admin/ops" className="text-clearance hover:underline">
              /admin/ops
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-col items-end gap-4">
          <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
            {[
              ["TOTAL", String(totals.total)],
              ["AVAILABLE", String(totals.available)],
              ["AOG", String(totals.aog)],
              ["MAINT", String(totals.maint)],
            ].map(([lbl, val]) => (
              <div key={lbl} className="flex flex-col items-end">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                  {lbl}
                </dt>
                <dd
                  className={[
                    "mt-1 font-serif text-[26px] font-light leading-none",
                    lbl === "AOG" && totals.aog > 0 ? "text-[var(--error)]" : "text-bone",
                  ].join(" ")}
                >
                  {val}
                </dd>
              </div>
            ))}
          </dl>
          <AircraftForm mode="create" operatorOptions={operatorOptions} />
        </div>
      </header>

      <div className="flex flex-col gap-10">
        {Array.from(byCategory.entries()).map(([cat, list]) => (
          <section key={cat}>
            <div className="mb-4 flex items-baseline gap-4 border-b border-ink-3 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                — {CATEGORY_LABEL[cat] ?? cat}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                {list.length} tail{list.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-ink-3">
                    {[
                      "Tail",
                      "Make/Model",
                      "Year",
                      "Pax",
                      "Range",
                      "Speed",
                      "Wi-Fi",
                      "Cabin",
                      "Base",
                      "Hours",
                      "Status",
                      "Operator",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr
                      key={r.id}
                      className={[
                        "border-b border-ink-3 transition-colors hover:bg-ink",
                        r.status === "aog" ? "bg-[rgba(164,69,58,0.06)]" : "",
                        r.status === "sold" ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      <td className="px-4 py-4 font-mono text-[12px] tracking-[0.04em]">
                        <Link
                          href={`/admin/aircraft/${r.id}`}
                          className="text-clearance hover:underline"
                        >
                          {r.tailNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4 font-serif text-[15px] text-bone">{r.makeModel}</td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone-2">
                        {r.yearManufactured ?? "—"}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone">
                        {r.seats}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone">
                        {r.rangeNm.toLocaleString()} NM
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone-2">
                        {r.speedKt} KT
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone-2">
                        {WIFI_LABEL[r.wifiType] ?? r.wifiType}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone-2">
                        {[
                          r.standupCabin ? "Stand-up" : null,
                          r.lieflatCapable ? "Lie-flat" : null,
                          r.petFriendly ? "Pet" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.06em] text-bone">
                        {r.baseIcao ?? "—"}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone-2">
                        {r.totalHours ? r.totalHours.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                            STATUS_CLASS[r.status] ?? "border-ink-3 text-bone-2",
                          ].join(" ")}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em]">
                        <Link
                          href={`/admin/operators/${r.operatorId}`}
                          className="text-bone-2 transition-colors hover:text-clearance"
                        >
                          {r.operatorName} →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
