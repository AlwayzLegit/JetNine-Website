"use client";

import Link from "next/link";
import { useId, useState } from "react";

export type CompareRow = {
  slug: string;
  name: string;
  pax: number;
  range: string;
  speed: string;
  endurance: string;
  sample: string;
};

/**
 * "How many people are flying?" card plus the quick-compare table. The
 * slider (1–16) picks the first category with enough seats: that row is
 * highlighted on surface-2 with a gold "Fits your group" pill, smaller
 * categories dim to 40%. Rows jump to the matching detail card below.
 */
export function PaxPicker({ rows }: { rows: CompareRow[] }) {
  const [pax, setPax] = useState(4);
  const headingId = useId();
  const first = rows.find((r) => r.pax >= pax);
  const hint = first
    ? `${first.name} and larger fit ${pax}. Smaller categories are greyed out below.`
    : "Groups over 16 usually fly on two aircraft — call us and we'll arrange it.";

  return (
    <>
      <section className="container-jn pt-12">
        <div className="card grid gap-6 px-7 py-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center max-md:px-5">
          <div>
            <p className="label-jn">Not sure which fits?</p>
            <p id={headingId} className="mt-1 text-[19px] font-medium">
              How many people are flying?
            </p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              aria-labelledby={headingId}
              aria-valuetext={`${pax} passengers`}
              className="range-jn my-5 flex-1"
            />
            <span className="min-w-[128px] font-serif text-[32px] font-light leading-none">
              {pax}{" "}
              <span className="font-sans text-[15px] font-normal text-bone-2">
                {pax === 1 ? "passenger" : "passengers"}
              </span>
            </span>
          </div>
          <p className="max-w-[26ch] text-[15px] text-bone-2 max-md:max-w-none" aria-live="polite">
            {hint}
          </p>
        </div>
      </section>

      <section className="container-jn pt-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Quick compare</p>
            <h2 className="title-section">Match the aircraft to the mission.</h2>
          </div>
          <p className="text-[14px] text-steel">All values approximate · range varies by load and weather</p>
        </div>

        <div className="card mt-7 overflow-hidden">
          {/* Wider than a phone: the table becomes a horizontal strip. */}
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="table-jn min-w-[900px] [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Passengers</th>
                  <th scope="col">Range</th>
                  <th scope="col">Speed</th>
                  <th scope="col">Endurance</th>
                  <th scope="col">Sample aircraft</th>
                  <th scope="col">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const fits = r.pax >= pax;
                  const isFit = first?.slug === r.slug;
                  return (
                    <tr
                      key={r.slug}
                      className={[
                        "transition-[background,opacity] duration-150",
                        isFit ? "bg-surface-2" : "",
                        fits ? "" : "opacity-40",
                      ].join(" ")}
                    >
                      <td className="align-middle">
                        <Link
                          href={`#${r.slug}`}
                          className="block w-fit font-serif text-[22px] leading-[1.1] text-bone transition-colors hover:text-clearance"
                        >
                          {r.name}
                        </Link>
                        {isFit ? (
                          <span className="pill mt-2 border border-gold bg-transparent text-gold">
                            Fits your group
                          </span>
                        ) : null}
                      </td>
                      <td className="align-middle">Up to {r.pax}</td>
                      <td className="align-middle">{r.range}</td>
                      <td className="align-middle">{r.speed}</td>
                      <td className="align-middle">{r.endurance}</td>
                      <td className="align-middle text-[14px] text-bone-2">{r.sample}</td>
                      <td className="align-middle text-right">
                        <Link
                          href={`#${r.slug}`}
                          aria-label={`Jump to ${r.name}`}
                          className="inline-flex h-11 w-11 items-center justify-center text-bone-2 transition-colors hover:text-bone"
                        >
                          →
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
    </>
  );
}
