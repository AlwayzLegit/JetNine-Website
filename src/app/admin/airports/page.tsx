import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { airports, fbos } from "@/db/schema/airports";
import { AirportCreateForm } from "@/components/admin/airport-create-form";
import { DeskEmpty, DeskHeader, DeskPage, DotSentence, NumberCard } from "@/components/admin/desk-ui";

export const dynamic = "force-dynamic";

const CUSTOMS_LABEL: Record<string, string> = {
  none: "—",
  user_fee: "User fee",
  aoe: "Airport of entry",
  intl: "International",
};

const CUSTOMS_CLASS: Record<string, string> = {
  none: "text-steel",
  user_fee: "text-bone-2",
  aoe: "text-gold",
  intl: "text-clearance",
};

type Row = {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  region: string | null;
  countryIso2: string;
  category: string | null;
  customs: string;
  active: boolean;
  fboCount: number;
};

export default async function AdminAirportsPage() {
  // Single grouped query — much cheaper than per-row fan-out for FBO counts.
  const rows = await db
    .select({
      id: airports.id,
      icao: airports.icao,
      iata: airports.iata,
      name: airports.name,
      city: airports.city,
      region: airports.region,
      countryIso2: airports.countryIso2,
      category: airports.category,
      customs: airports.customs,
      active: airports.active,
      fboCount: sql<number>`(
        select count(*)::int from public.fbos f where f.airport_id = ${airports.id}
      )`,
    })
    .from(airports)
    .orderBy(asc(airports.countryIso2), asc(airports.icao));

  const totalFbos = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(fbos)
    .then((r) => r[0]?.n ?? 0);

  const byCountry = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byCountry.get(r.countryIso2) ?? [];
    arr.push(r);
    byCountry.set(r.countryIso2, arr);
  }

  const totals = {
    airports: rows.length,
    active: rows.filter((r) => r.active).length,
    intl: rows.filter((r) => r.customs === "intl").length,
    countries: byCountry.size,
  };

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/settings/reference", label: "Reference data" }}
        title="Airports & FBOs"
        lead={`${totals.airports} airports and ${totalFbos} FBOs, grouped by country. Open an airport to edit its details, attach FBOs or mark it inactive; writes need the admin role.`}
      />

      <div className="mt-6 flex justify-end">
        <AirportCreateForm />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NumberCard label="Airports" value={totals.airports} />
        <NumberCard label="Active" value={totals.active} />
        <NumberCard label="International" value={totals.intl} />
        <NumberCard label="Countries" value={totals.countries} />
      </div>

      {rows.length === 0 ? (
        <DeskEmpty
          title="No airports yet."
          body={
            <>
              Add your first airport above. The 43-airport seed migration should pre-populate this on fresh
              installs — run <code>pnpm db:migrate</code> if you&rsquo;re looking at an empty list and have
              unapplied migrations.
            </>
          }
        />
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {Array.from(byCountry.entries()).map(([country, list]) => (
            <section key={country}>
              <h2 className="label-jn mb-2.5 text-[13px]">
                {country}
                <span className="text-steel-dim">
                  {" "}
                  · {list.length} airport{list.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-jn min-w-[900px]">
                    <thead>
                      <tr>
                        {["ICAO", "IATA", "Name", "City", "Customs", "FBOs", "Status", ""].map((h, i) => (
                          <th key={h || i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr
                          key={r.id}
                          className={[
                            "transition-colors hover:bg-surface-2/50",
                            !r.active ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          <td>
                            <Link
                              href={`/admin/airports/${r.id}`}
                              className="font-medium text-bone hover:underline"
                            >
                              {r.icao}
                            </Link>
                          </td>
                          <td className="text-bone-2">{r.iata ?? "—"}</td>
                          <td className="text-bone">{r.name}</td>
                          <td className="text-bone-2">
                            {r.city}
                            {r.region ? <span className="text-steel"> · {r.region}</span> : null}
                          </td>
                          <td className={CUSTOMS_CLASS[r.customs] ?? "text-bone-2"}>
                            {CUSTOMS_LABEL[r.customs] ?? r.customs}
                          </td>
                          <td className="text-bone">{r.fboCount}</td>
                          <td>
                            <span className="pill pill-outline">
                              {r.active ? (
                                <DotSentence tone="success">Active</DotSentence>
                              ) : (
                                <DotSentence tone="steel">Inactive</DotSentence>
                              )}
                            </span>
                          </td>
                          <td className="text-right">
                            <Link href={`/admin/airports/${r.id}`} className="btn btn-secondary btn-sm">
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
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
