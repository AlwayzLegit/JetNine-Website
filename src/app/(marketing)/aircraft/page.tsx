import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { FleetImage } from "@/components/aircraft/fleet-image";
import { PaxPicker, type CompareRow } from "@/components/aircraft/pax-picker";
import { hoursLabel, kt, nm, plainWords } from "@/components/aircraft/plain";
import { SITE } from "@/lib/constants";
import { FLEET } from "@/lib/fleet";

export const metadata: Metadata = pageMetadata({
  title: "Charter Fleet — Turboprop to Ultra-Long-Range Jets",
  description:
    "Six categories, hundreds of aircraft. Turboprop through ultra long range — match the aircraft to the mission.",
  path: "/aircraft",
});

export default function AircraftPage() {
  const rows: CompareRow[] = FLEET.map((f) => ({
    slug: f.slug,
    name: f.name,
    pax: f.pax,
    range: nm(f.rangeNm),
    speed: kt(f.speedKt),
    endurance: hoursLabel(f.enduranceHr),
    sample: f.sampleAircraft.join(" · "),
  }));

  return (
    <>
      <PageHero
        eyebrow="Aircraft"
        title="Choose your aircraft."
        lead="Six categories. Hundreds of aircraft. Whether it’s a 90-minute hop or a transpacific mission, the right aircraft matters more than the destination — and we surface it in minutes."
        imageSrc="/images/hero/aircraft.webp"
        imagePosition="62% center"
      />

      {/* Passenger slider + quick-compare table (client state lives here). */}
      <PaxPicker rows={rows} />

      {/* ─── Six detail cards, anchored from the table ─── */}
      <section className="container-jn pt-16" aria-label="Aircraft categories">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {FLEET.map((f) => (
            <Link
              key={f.slug}
              id={f.slug}
              href={f.href}
              className="card flex flex-col overflow-hidden scroll-mt-[calc(var(--header-h)+24px)]"
            >
              <FleetImage
                src={f.imageUrl}
                aspect="16/9"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="flex flex-col gap-3.5 px-8 pt-7 pb-8 max-md:px-5 max-md:pt-5 max-md:pb-6">
                <h2 className="title-card">{f.name}</h2>
                <p className="label-jn">
                  Up to {f.pax} passengers · range {nm(f.rangeNm)}
                </p>
                <p className="text-bone-2">{plainWords(f.blurb)}</p>
                <ul className="flex flex-wrap gap-2" aria-label="Sample aircraft">
                  {f.sampleAircraft.map((s) => (
                    <li key={s} className="chip chip-sm cursor-default">
                      {s}
                    </li>
                  ))}
                </ul>
                <span className="mt-1 text-[15px] font-medium">
                  View specs <span className="arrow">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <CtaBand
        title="Not sure which fits?"
        body="Tell us the trip. Passengers, route, dates. We’ll come back with the right aircraft — usually three to five options to pick from."
        primary={{ label: "Price a mission", href: "/quote/mission" }}
        secondary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
