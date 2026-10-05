"use client";

import { useId, useState, type ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode; extra?: ReactNode };

/**
 * Boxed question rows from the light company prototypes: each question
 * is its own bordered white box (or, with `joined`, rows inside one box),
 * one open at a time, the first open by default.
 *
 * - `tone="serif"`: 16–17px serif question (About, Programs).
 * - `tone="sans"`: 14px bold Arial question (Contact, How it works, Safety).
 */
export function FaqList({
  items,
  tone = "sans",
  joined = false,
  defaultOpen = 0,
  marks = ["+", "−"],
  className = "",
}: {
  items: FaqItem[];
  tone?: "serif" | "sans";
  joined?: boolean;
  defaultOpen?: number;
  /** [closed, open] glyphs. */
  marks?: [string, string];
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const base = useId();

  return (
    <div className={[joined ? "border border-line bg-surface" : "flex flex-col gap-2", className].join(" ")}>
      {items.map((f, i) => {
        const isOpen = open === i;
        const panelId = `${base}-p${i}`;
        return (
          <div
            key={f.q}
            className={
              joined
                ? "border-b border-line last:border-b-0"
                : `border bg-surface ${isOpen && tone === "serif" ? "border-gold-light" : "border-line"}`
            }
          >
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className={[
                  "flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent text-left text-bone",
                  tone === "serif" ? "px-5 py-[10px] font-serif text-[17px] font-normal" : "px-[18px] py-[10px] font-sans text-[14px] font-bold",
                ].join(" ")}
              >
                <span>{f.q}</span>
                <span aria-hidden="true" className={tone === "serif" ? "text-[20px] leading-none text-gold" : "text-[16px] leading-none"}>
                  {isOpen ? marks[1] : marks[0]}
                </span>
              </button>
            </h3>
            <div id={panelId} hidden={!isOpen} className="px-[18px] pb-[14px]">
              <div className={tone === "serif" ? "font-serif text-[15px] leading-[1.5] text-steel" : "text-[13px] leading-[1.55] text-steel"}>
                {f.a}
              </div>
              {f.extra}
            </div>
          </div>
        );
      })}
    </div>
  );
}
