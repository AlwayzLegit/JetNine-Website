"use client";

import { useId, useState } from "react";

export type FaqEntry = { q: string; a: string };

type Props = {
  items: FaqEntry[];
  /** Index open on first render; -1 for all closed. */
  defaultOpen?: number;
  className?: string;
};

/**
 * Accordion rows from the simplification grammar: one open at a time,
 * `+` / `−` on the right, clicking the open row closes it. Buttons carry
 * aria-expanded / aria-controls; the body is a labelled region.
 */
export function FaqAccordion({ items, defaultOpen = 0, className = "" }: Props) {
  const [open, setOpen] = useState<number>(defaultOpen);
  const base = useId();

  return (
    <div className={`accordion ${className}`.trim()}>
      {items.map((f, i) => {
        const isOpen = open === i;
        const panelId = `${base}-panel-${i}`;
        const triggerId = `${base}-trigger-${i}`;
        return (
          <div key={f.q} className="accordion-row">
            <h3>
              <button
                type="button"
                id={triggerId}
                className="accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span>{f.q}</span>
                <span className="accordion-sign" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!isOpen}
              className="accordion-body"
            >
              <p>{f.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
