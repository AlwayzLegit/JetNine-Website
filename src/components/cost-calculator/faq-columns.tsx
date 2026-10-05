"use client";

import { useState } from "react";

export type CalcFaq = { q: string; a: string };

/** "Before you calculate." — two columns of single-open accordions. */
export function FaqColumns({ items }: { items: CalcFaq[] }) {
  const [open, setOpen] = useState(0);
  const half = Math.ceil(items.length / 2);
  const cols = [items.slice(0, half), items.slice(half)];
  return (
    <div className="mt-[10px] grid items-start gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
      {cols.map((col, c) => (
        <div key={c} className="flex flex-col gap-[10px]">
          {col.map((f, j) => {
            const i = c * half + j;
            const isOpen = open === i;
            const id = `calc-faq-${i}`;
            return (
              <div key={f.q} className="border border-line bg-[#FBFAF7]">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-[14px] py-[10px] text-left text-[13px] font-bold text-bone"
                  >
                    <span>{f.q}</span>
                    <span aria-hidden="true" className="text-[16px] text-gold">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                {/* Answers stay in the HTML (hidden) so crawlers see them. */}
                <p id={id} hidden={!isOpen} className="px-[14px] pb-3 text-[13px] leading-[1.5] text-steel">
                  {f.a}
                </p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
