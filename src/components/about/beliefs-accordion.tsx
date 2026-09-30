"use client";

import { useState } from "react";

export type Belief = { num: string; title: string; why: string };

/**
 * The five beliefs on /about as a Fraunces-numbered accordion — one row
 * open at a time, the first open by default, `+` / `−` on the right.
 */
export function BeliefsAccordion({ beliefs }: { beliefs: Belief[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="accordion mt-8">
      {beliefs.map((b, i) => {
        const isOpen = open === i;
        const bodyId = `belief-${b.num}`;
        return (
          <div key={b.num} className="accordion-row">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              aria-controls={bodyId}
              className="accordion-trigger grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-5 py-6 max-md:grid-cols-[44px_minmax(0,1fr)_auto] max-md:gap-3 max-md:py-5"
            >
              <span
                className="font-serif text-[40px] font-light leading-none text-clearance max-md:text-[30px]"
                style={{ fontVariationSettings: '"opsz" 144' }}
              >
                {b.num}
              </span>
              <span className="font-serif text-[26px] font-normal leading-[1.25] max-md:text-[21px]">
                {b.title}
              </span>
              <span className="accordion-sign" aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div id={bodyId} hidden={!isOpen}>
              <p className="accordion-body pl-[84px] pr-16 leading-[1.7] max-md:pl-0 max-md:pr-0">
                {b.why}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
