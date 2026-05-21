import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { airports, fbos } from "@/db/schema/airports";
import { AirportEditForm } from "@/components/admin/airport-edit-form";
import { FboEditor } from "@/components/admin/fbo-editor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminAirportDetailPage({ params }: Props) {
  const { id } = await params;

  const [airport] = await db.select().from(airports).where(eq(airports.id, id));
  if (!airport) notFound();

  const fboRows = await db
    .select()
    .from(fbos)
    .where(eq(fbos.airportId, id))
    .orderBy(asc(fbos.name));

  return (
    <div className="container-jn py-8">
      <div className="mb-8 border-b border-ink-3 pb-6">
        <nav className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
          <Link href="/admin/airports" className="transition-colors hover:text-clearance">
            Airports
          </Link>{" "}
          <span className="text-steel">/</span>{" "}
          <span className="text-bone">{airport.icao}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-baseline gap-4">
          <span
            className="font-mono text-[36px] tracking-[0.06em] text-clearance"
            style={{ letterSpacing: "0.06em" }}
          >
            {airport.icao}
          </span>
          {airport.iata ? (
            <span className="font-mono text-[18px] tracking-[0.04em] text-bone-2">
              {airport.iata}
            </span>
          ) : null}
          <span
            className="font-serif text-[26px] font-light leading-none text-bone"
            style={{ letterSpacing: "-0.01em" }}
          >
            {airport.name}
          </span>
          {!airport.active ? (
            <span className="rounded-full border border-steel px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              Inactive
            </span>
          ) : (
            <span className="rounded-full border border-[var(--success)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--success)]">
              Active
            </span>
          )}
        </div>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
          {airport.city}
          {airport.region ? ` · ${airport.region}` : ""} · {airport.countryIso2}
          {airport.tz ? ` · ${airport.tz}` : ""}
          {airport.longestRunwayFt ? ` · runway ${airport.longestRunwayFt.toLocaleString()} ft` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
          <h2 className="caption mb-5">— Fields</h2>
          <AirportEditForm initial={airport} />
        </section>

        <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="caption">— FBOs · {fboRows.length}</h2>
          </div>
          <FboEditor airportId={airport.id} initial={fboRows} />
        </section>
      </div>
    </div>
  );
}
