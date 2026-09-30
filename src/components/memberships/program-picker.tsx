"use client";

import Link from "next/link";
import { useState } from "react";
import { PROGRAMS, SUGGESTION, pickProgram } from "./programs";

const MIN = 5;
const MAX = 200;
const STEP = 5;

/**
 * "How many hours a year?" slider + the three program cards. The slider
 * picks one program (on-demand < 25 h, Card 25–100 h, Reserve > 100 h),
 * which gets the selected border and the primary CTA; the other two stay
 * secondary. Holds the only state on the page besides the FAQ.
 */
export function ProgramPicker() {
  const [hours, setHours] = useState(40);
  const pick = pickProgram(hours);

  return (
    <>
      <section className="container-jn pt-12 max-md:pt-8">
        <div className="card grid items-center gap-6 px-7 py-6 max-md:px-5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div>
            <p className="label-jn">Pick by how often you actually fly</p>
            <label htmlFor="hours-a-year" className="mt-1 block text-[19px] font-medium leading-[1.3]">
              How many hours a year?
            </label>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex min-h-11 flex-1 items-center">
              <input
                id="hours-a-year"
                type="range"
                min={MIN}
                max={MAX}
                step={STEP}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                aria-valuetext={`${hours} hours a year`}
                className="range-jn"
              />
            </div>
            <span className="min-w-[150px] font-serif text-[32px] font-light leading-none">
              {hours}{" "}
              <span className="font-sans text-[15px] font-normal text-bone-2">hours / year</span>
            </span>
          </div>
          <p className="text-[15px] lg:max-w-[28ch]" aria-live="polite">
            <span className="text-steel">Our suggestion:</span>{" "}
            <strong className="font-medium">{SUGGESTION[pick]}</strong>
          </p>
        </div>
      </section>

      <section id="tiers" className="container-jn pt-12 max-md:pt-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROGRAMS.map((p) => {
            const selected = p.key === pick;
            const ctaClass = `btn btn-lg mt-auto w-full ${selected ? "btn-primary" : "btn-secondary"}`;
            return (
              <article
                key={p.key}
                className={`card flex flex-col gap-[18px] p-8 max-md:p-6 ${selected ? "card-selected" : ""}`}
                aria-current={selected ? "true" : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-steel">{p.badge}</span>
                  {p.chip ? <span className="pill pill-clearance text-[12px] font-semibold">{p.chip}</span> : null}
                </div>
                <h3 className="font-serif text-[32px] font-normal leading-[1.1]">{p.name}</h3>
                <p className="text-bone-2">{p.strap}</p>
                <div className="border-t border-line pt-[18px]">
                  <div className="font-serif text-[40px] font-light leading-none">{p.price}</div>
                  <p className="mt-2 text-[14px] text-bone-2">{p.priceSub}</p>
                </div>
                <ul className="flex flex-col gap-[10px] border-t border-line pt-[18px] text-[15px]">
                  {p.features.map((f) => (
                    <li key={f} className="grid grid-cols-[auto_1fr] gap-[10px]">
                      <span className="text-clearance" aria-hidden="true">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.cta.href.startsWith("#") ? (
                  <a href={p.cta.href} className={ctaClass}>
                    {p.cta.label} <span className="arrow" aria-hidden="true">→</span>
                  </a>
                ) : (
                  <Link href={p.cta.href} className={ctaClass}>
                    {p.cta.label} <span className="arrow" aria-hidden="true">→</span>
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
