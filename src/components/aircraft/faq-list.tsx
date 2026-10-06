"use client";

import { useState } from "react";

/**
 * FAQ rows from the light aircraft templates. `panel`: one bordered panel
 * of rows (Aircraft page). `cards`: separate bordered cards in two columns
 * (category and model pages). One row open at a time, the first by
 * default. Answers stay in the DOM (hidden) so they remain indexable.
 */
export function FaqList({ items, layout = "cards" }: { items: { q: string; a: string }[]; layout?: "panel" | "cards" }) {
  const [open, setOpen] = useState(0);

  const row = (f: { q: string; a: string }, i: number) => {
    const on = open === i;
    const id = `faq-${layout}-${i}`;
    if (layout === "panel") {
      return (
        <div key={f.q} className="border-t border-line first:border-t-0">
          <button
            type="button"
            aria-expanded={on}
            aria-controls={id}
            onClick={() => setOpen(on ? -1 : i)}
            className="flex w-full items-center justify-between gap-4 bg-transparent py-3 text-left text-[14px] font-bold text-bone"
          >
            <span>{f.q}</span>
            <span aria-hidden="true" className="text-[18px] font-normal text-gold">
              {on ? "−" : "+"}
            </span>
          </button>
          <p id={id} hidden={!on} className="max-w-[80ch] pb-[14px] text-[13px] leading-[1.55] text-steel">
            {f.a}
          </p>
        </div>
      );
    }
    return (
      <div key={f.q} className="border border-line bg-surface">
        <button
          type="button"
          aria-expanded={on}
          aria-controls={id}
          onClick={() => setOpen(on ? -1 : i)}
          className="flex w-full items-center justify-between gap-3 bg-transparent px-[14px] py-[10px] text-left text-[13px] font-bold text-bone"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="text-[12px] text-gold">
              {on ? "●" : "›"}
            </span>
            {f.q}
          </span>
          <span aria-hidden="true" className="text-[16px] text-gold">
            {on ? "−" : "+"}
          </span>
        </button>
        <p id={id} hidden={!on} className="px-[14px] pb-3 pl-8 text-[13px] leading-[1.5] text-steel">
          {f.a}
        </p>
      </div>
    );
  };

  if (layout === "panel") {
    return <div className="mt-3 border border-line bg-surface px-4">{items.map(row)}</div>;
  }
  const left = items.slice(0, Math.ceil(items.length / 2));
  const right = items.slice(left.length);
  return (
    <div className="mt-[10px] grid items-start gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
      <div className="flex flex-col gap-[10px]">{left.map((f, i) => row(f, i))}</div>
      <div className="flex flex-col gap-[10px]">{right.map((f, i) => row(f, i + left.length))}</div>
    </div>
  );
}
