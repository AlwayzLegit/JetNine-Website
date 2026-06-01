import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";
import { FLEET, formatKt, formatNm, formatPax } from "@/lib/fleet";

export const metadata: Metadata = pageMetadata({
  title: "Aircraft",
  description:
    "Six categories, hundreds of airframes. Turboprop through ultra long range — match the airframe to the mission.",
  path: "/aircraft",
  image: "/images/fleet/ultra.webp",
  imageAlt: "JetNine aircraft — Bombardier Global 7500 banking through cloudscape",
});

export default function AircraftPage() {
  return (
    <>
      <PageHeader
        kicker="Aircraft"
        title="Choose your aircraft."
        lead="Six categories. Hundreds of airframes. Whether it’s a 90-minute hop or a transpacific mission, the right airframe matters more than the destination — and we surface it in minutes."
      />

      {/* ─── Quick compare table ─── */}
      <section className="py-24 sm:py-16">
        <div className="container-jn">
          <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="caption mb-4 inline-flex items-center gap-3">
                <span className="block h-px w-8 bg-clearance" /> Quick compare
              </p>
              <h2 className="font-serif text-[32px] font-normal leading-tight">
                Match the airframe to the mission.
              </h2>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-steel">
              All values approximate · Range varies by load &amp; weather
            </span>
          </Reveal>

          {/* Desktop: real table. Mobile: stacked cards via responsive CSS. */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="max-md:hidden">
                <tr>
                  {["Category", "Pax", "Range", "Speed", "Endurance", "Sample aircraft", ""].map(
                    (h) => (
                      <th
                        key={h || "spacer"}
                        className="border-b border-ink-3 bg-ink px-6 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {FLEET.map((f) => (
                  <tr
                    key={f.slug}
                    className="group border-b border-ink-3 transition-colors hover:bg-ink-2 max-md:block max-md:border-b max-md:px-0 max-md:py-4"
                  >
                    <td className="px-6 py-6 font-serif text-[22px] font-normal text-bone group-hover:shadow-[inset_2px_0_0_var(--clearance)] max-md:block max-md:px-0 max-md:pb-3">
                      <Link href={f.href} className="block">
                        {f.name}
                      </Link>
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.04em] text-bone-2 max-md:block max-md:px-0 max-md:py-1.5">
                      {formatPax(f.pax)}
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.04em] text-bone-2 max-md:block max-md:px-0 max-md:py-1.5">
                      {formatNm(f.rangeNm)}
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.04em] text-bone-2 max-md:block max-md:px-0 max-md:py-1.5">
                      {formatKt(f.speedKt)}
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.04em] text-bone-2 max-md:block max-md:px-0 max-md:py-1.5">
                      {f.enduranceHr}
                    </td>
                    <td className="px-6 py-6 font-mono text-[12px] tracking-[0.04em] text-bone-2 max-md:block max-md:px-0 max-md:py-1.5">
                      {f.sampleAircraft.join(" · ")}
                    </td>
                    <td className="px-6 py-6 text-right max-md:hidden">
                      <Link
                        href={f.href}
                        aria-label={`Explore ${f.name}`}
                        className="inline-block text-clearance transition-transform duration-200 ease-out-quint group-hover:translate-x-1"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── 2-up category cards ─── */}
      <section className="pb-24">
        <div className="container-jn">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {FLEET.map((f, i) => (
              <Reveal
                key={f.slug}
                stagger={(i % 2) as 0 | 1}
                className="group"
              >
                <Link
                  href={f.href}
                  className="flex h-full flex-col overflow-hidden rounded-[4px] border border-ink-3 bg-ink-2 transition-all duration-300 ease-out-quint hover:-translate-y-0.5 hover:border-[rgba(232,226,210,0.3)]"
                >
                  <div className="overflow-hidden">
                    <div className="transition-transform duration-[600ms] ease-out-quint group-hover:scale-[1.04]">
                      <Placeholder
                        caption={f.cap.replace(/^— /, "")}
                        aspect="16/9"
                        imageUrl={f.imageUrl}
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-5 p-10">
                    <h3 className="font-serif text-[32px] font-normal leading-[1.15] tracking-tight text-bone">
                      {f.name}
                    </h3>
                    <p className="text-[15px] leading-[1.6] text-bone-2">{f.blurb}</p>
                    <div className="mt-2 grid grid-cols-3 gap-4 border-t border-ink-3 pt-6">
                      {[
                        ["PAX", f.pax.toString()],
                        ["RANGE", formatNm(f.rangeNm)],
                        ["SPEED", formatKt(f.speedKt)],
                      ].map(([lbl, val]) => (
                        <div key={lbl} className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                            {lbl}
                          </span>
                          <span className="font-mono text-[14px] tracking-[0.04em] text-bone">
                            {val}
                          </span>
                        </div>
                      ))}
                    </div>
                    <span className="mt-2 inline-flex items-center gap-2 self-start font-mono text-[11px] uppercase tracking-[0.14em] text-bone">
                      Explore <span className="arrow">→</span>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA
        heading="Not sure which fits?"
        body="Tell us the mission. Pax count, sectors, dates. We’ll come back with the right airframe — usually three to five options to pick from."
      />
    </>
  );
}
