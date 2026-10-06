"use client";

import { useId, useState } from "react";

// The per-post Q&A block in the light FAQ grammar: white ruled cards, a
// circled + / − on the right, one open at a time. Answers stay in the DOM
// (hidden) so they match the FAQPage JSON-LD the page emits.
export function PostFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();

  return (
    <section className="mt-14" aria-labelledby={`${id}-heading`}>
      <p className="eyebrow !mb-1">Questions this raises</p>
      <h2 id={`${id}-heading`} className="font-serif text-[32px] font-normal leading-[1.1]">
        Asked at the desk
      </h2>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className={`border bg-white ${isOpen ? "border-bone" : "border-line"}`}>
              <button
                type="button"
                className="flex w-full items-center gap-4 border-0 bg-transparent px-5 py-4 text-left"
                aria-expanded={isOpen}
                aria-controls={`${id}-body-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="min-w-0 flex-1 font-serif text-[20px] leading-[1.25] text-bone">{f.q}</span>
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-bone text-[16px] leading-none text-bone"
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              <div id={`${id}-body-${i}`} hidden={!isOpen} className="px-5 pb-5 text-[15px] leading-[1.6] text-steel">
                <p className="max-w-[68ch]">{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
