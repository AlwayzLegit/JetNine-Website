import Link from "next/link";
import { asc, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { AircraftForm } from "@/components/admin/aircraft-form";
import { SOURCING_INELIGIBLE_STATUSES } from "@/lib/operator-eligibility";
import { DeskEmpty, DeskHeader, DeskPage, DotSentence, NumberCard } from "@/components/admin/desk-ui";

export const dynamic = "force-dynamic";

type Tone = "gold" | "steel" | "success" | "danger";

const STATUS_WORDS: Record<string, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "success" },
  aog: { label: "Grounded (AOG)", tone: "danger" },
  maint: { label: "In maintenance", tone: "gold" },
  sold: { label: "Sold / retired", tone: "steel" },
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
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/settings/reference", label: "Reference data" }}
        title="Aircraft"
        lead={
          <>
            Every aircraft in the network, grouped by category. Tail numbers are unique and each links back to
            its operator; the 14-day planner is on the{" "}
            <Link href="/admin/ops" className="text-link">
              live ops board
            </Link>
            .
          </>
        }
      />

      <div className="mt-6 flex justify-end">
        <AircraftForm mode="create" operatorOptions={operatorOptions} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NumberCard label="Aircraft" value={totals.total} />
        <NumberCard label="Available" value={totals.available} />
        <NumberCard
          label="Grounded (AOG)"
          value={totals.aog}
          note={totals.aog > 0 ? "Out of service" : undefined}
          noteTone={totals.aog > 0 ? "danger" : "steel"}
        />
        <NumberCard label="In maintenance" value={totals.maint} />
      </div>

      {rows.length === 0 ? (
        <DeskEmpty title="No aircraft yet." body="Add the first aircraft above. Each one needs an operator on file." />
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {Array.from(byCategory.entries()).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="label-jn mb-2.5 text-[13px]">
                {CATEGORY_LABEL[cat] ?? cat}
                <span className="text-steel-dim">
                  {" "}
                  · {list.length} aircraft
                </span>
              </h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-jn min-w-[1000px]">
                    <thead>
                      <tr>
                        {[
                          "Tail",
                          "Make / model",
                          "Year",
                          "Seats",
                          "Range",
                          "Speed",
                          "Wi-Fi",
                          "Cabin",
                          "Base",
                          "Hours",
                          "Status",
                          "Operator",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => {
                        const s = STATUS_WORDS[r.status] ?? { label: r.status, tone: "steel" as Tone };
                        return (
                          <tr
                            key={r.id}
                            className={[
                              "transition-colors hover:bg-surface-2/50",
                              r.status === "sold" ? "opacity-50" : "",
                            ].join(" ")}
                          >
                            <td>
                              <Link
                                href={`/admin/aircraft/${r.id}`}
                                className="font-medium text-bone hover:underline"
                              >
                                {r.tailNumber}
                              </Link>
                            </td>
                            <td className="text-bone">{r.makeModel}</td>
                            <td className="text-bone-2">{r.yearManufactured ?? "—"}</td>
                            <td className="text-bone">{r.seats}</td>
                            <td className="text-bone">{r.rangeNm.toLocaleString()} nm</td>
                            <td className="text-bone-2">{r.speedKt} kt</td>
                            <td className="text-bone-2">{WIFI_LABEL[r.wifiType] ?? r.wifiType}</td>
                            <td className="text-bone-2">
                              {[
                                r.standupCabin ? "Stand-up" : null,
                                r.lieflatCapable ? "Lie-flat" : null,
                                r.petFriendly ? "Pets" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </td>
                            <td className="text-bone">{r.baseIcao ?? "—"}</td>
                            <td className="text-bone-2">{r.totalHours ? r.totalHours.toLocaleString() : "—"}</td>
                            <td>
                              <span className="pill pill-outline">
                                <DotSentence tone={s.tone}>{s.label}</DotSentence>
                              </span>
                            </td>
                            <td>
                              <Link
                                href={`/admin/operators/${r.operatorId}`}
                                className="text-bone-2 transition-colors hover:text-bone"
                              >
                                {r.operatorName} →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </DeskPage>
  );
}
