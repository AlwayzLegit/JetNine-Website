"use client";

import { useId, useState } from "react";

// The per-post Q&A block, on the grammar's accordion: one row open at a
// time, + / − on the right. The FAQPage JSON-LD is emitted by the page.
export function PostFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();

  return (
    <section className="mt-16" aria-labelledby={`${id}-heading`}>
      <p className="eyebrow">Questions this raises</p>
      <h2 id={`${id}-heading`} className="title-section mb-6 !text-[clamp(28px,3vw,36px)]">
        Asked at the desk
      </h2>
      <div className="accordion">
        {items.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="accordion-row">
              <button
                type="button"
                className="accordion-trigger"
                aria-expanded={isOpen}
                aria-controls={`${id}-body-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{f.q}</span>
                <span className="accordion-sign" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              <div id={`${id}-body-${i}`} className="accordion-body" hidden={!isOpen}>
                <p>{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
