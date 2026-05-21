import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { airports, fbos } from "@/db/schema/airports";
import { AirportCreateForm } from "@/components/admin/airport-create-form";

export const dynamic = "force-dynamic";

const CUSTOMS_LABEL: Record<string, string> = {
  none: "—",
  user_fee: "User fee",
  aoe: "AOE",
  intl: "Intl",
};

const CUSTOMS_CLASS: Record<string, string> = {
  none: "text-steel",
  user_fee: "text-bone-2",
  aoe: "text-[var(--warn)]",
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
    <div className="container-jn py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Admin · airports</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            {totals.airports} airports · {totalFbos} FBOs.
          </h1>
          <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
            Grouped by country, sorted by ICAO. Click into a row to edit fields, attach FBOs, or
            mark inactive. Admin role required for any writes.
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["AIRPORTS", String(totals.airports)],
            ["ACTIVE", String(totals.active)],
            ["INTL", String(totals.intl)],
            ["COUNTRIES", String(totals.countries)],
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

      <div className="mb-8">
        <AirportCreateForm />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Empty catalog</p>
          <p className="mx-auto mt-3 max-w-[48ch] text-[14px] leading-[1.55] text-bone-2">
            Add your first airport above. The 43-airport seed migration should pre-populate this on
            fresh installs — run <code className="font-mono text-clearance">pnpm db:migrate</code>{" "}
            if you&rsquo;re looking at an empty list and have unapplied migrations.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {Array.from(byCountry.entries()).map(([country, list]) => (
            <section key={country}>
              <div className="mb-4 flex items-baseline gap-4 border-b border-ink-3 pb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                  — {country}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                  {list.length} airport{list.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto rounded-[4px] border border-ink-3 bg-ink-2">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-ink-3">
                      {["ICAO", "IATA", "Name", "City", "Customs", "FBOs", "Status", ""].map((h) => (
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
                          !r.active ? "opacity-50" : "",
                        ].join(" ")}
                      >
                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/airports/${r.id}`}
                            className="font-mono text-[12px] tracking-[0.06em] text-clearance hover:underline"
                          >
                            {r.icao}
                          </Link>
                        </td>
                        <td className="px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-bone-2">
                          {r.iata ?? "—"}
                        </td>
                        <td className="px-4 py-4 font-serif text-[14px] text-bone">{r.name}</td>
                        <td className="px-4 py-4 text-[13px] text-bone-2">
                          {r.city}
                          {r.region ? (
                            <span className="ml-2 font-mono text-[10px] text-steel">
                              · {r.region}
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={[
                            "px-4 py-4 font-mono text-[10px] uppercase tracking-[0.1em]",
                            CUSTOMS_CLASS[r.customs] ?? "text-bone-2",
                          ].join(" ")}
                        >
                          {CUSTOMS_LABEL[r.customs] ?? r.customs}
                        </td>
                        <td className="px-4 py-4 font-mono text-[12px] tracking-[0.04em] text-bone">
                          {r.fboCount}
                        </td>
                        <td className="px-4 py-4">
                          {r.active ? (
                            <span className="rounded-full border border-[var(--success)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--success)]">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-full border border-steel px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/admin/airports/${r.id}`}
                            className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
                          >
                            Open →
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
      )}
    </div>
  );
}
