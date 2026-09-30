"use client";

import { useState } from "react";

export type FloorItem = {
  area: string;
  lead: string;
  body: string;
  preferred: string;
};

// "The floor" from the Safety prototype: accordion rows with a 180px area
// column on the left, the lead line as the trigger, and a body plus a
// gold "Preferred:" line when open. One row open at a time; the first
// row starts open.
export function FloorAccordion({ items }: { items: FloorItem[] }) {
  const [open, setOpen] = useState<number>(0);

  return (
    <div className="accordion mt-8">
      {items.map((f, i) => {
        const isOpen = open === i;
        const panelId = `floor-panel-${i}`;
        return (
          <div key={f.area} className="accordion-row">
            <button
              type="button"
              className="accordion-trigger !grid !grid-cols-[minmax(0,1fr)_auto] !items-baseline !py-[22px] !text-[20px] max-md:!gap-y-1.5 md:!grid-cols-[180px_minmax(0,1fr)_auto]"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen((cur) => (cur === i ? -1 : i))}
            >
              <span className="label-jn max-md:col-span-2">{f.area}</span>
              <span>{f.lead}</span>
              <span className="accordion-sign" aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div
              id={panelId}
              hidden={!isOpen}
              className="grid gap-6 pb-6 md:grid-cols-[180px_minmax(0,1fr)]"
            >
              <span aria-hidden="true" className="max-md:hidden" />
              <div>
                <p className="max-w-[64ch] text-bone-2">{f.body}</p>
                <p className="mt-2.5 text-[15px] text-bone-2">
                  <strong className="font-semibold text-gold">Preferred:</strong> {f.preferred}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
