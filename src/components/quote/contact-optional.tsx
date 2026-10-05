"use client";

import { useId, useState } from "react";
import { useQuoteStore } from "@/lib/quote-store";
import { BEST_TIMES, SOURCES, bestTimeLabel } from "@/components/quote/contact-options";

/**
 * Collapsed card for the two optional contact questions (best time to
 * reach you, how you heard about us). The header always shows the
 * current selection so nothing is hidden when the card is closed.
 */
export function ContactOptional() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const bestTime = useQuoteStore((s) => s.bestTime);
  const source = useQuoteStore((s) => s.source);
  const setBestTime = useQuoteStore((s) => s.setBestTime);
  const setSource = useQuoteStore((s) => s.setSource);

  const summary = `${bestTimeLabel(bestTime)}${source ? ` · ${source}` : ""}`;

  return (
    <section className="overflow-hidden rounded-[3px] border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[52px] w-full items-center justify-between gap-4 px-4 py-3 text-left text-bone transition-colors hover:bg-ink"
      >
        <span>
          <span className="block text-[15px] font-semibold leading-[1.35]">
            Optional: best time to reach you &amp; how you heard about us
          </span>
          <span className="mt-0.5 block text-[13px] text-steel">{summary}</span>
        </span>
        <span className="shrink-0 text-[13px] text-steel underline underline-offset-[3px]">{open ? "Hide" : "Show"}</span>
      </button>

      <div id={panelId} hidden={!open} className="border-t border-line-faint px-4 pb-4 pt-3.5">
        <h3 className="text-[14px] font-semibold text-bone">When are you easiest to reach?</h3>
        <p className="mb-[10px] mt-0.5 text-[13px] text-steel">
          All times in your local timezone. Dispatch operates 24/7 — pick what&rsquo;s convenient.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Best time to reach you">
          {BEST_TIMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip chip-sm max-md:!h-11"
              aria-pressed={bestTime === t.id}
              onClick={() => setBestTime(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <h3 className="mt-4 text-[14px] font-semibold text-bone">How did you hear about us?</h3>
        <p className="mb-[10px] mt-0.5 text-[13px] text-steel">
          Optional — helps us know which channels are working.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="How you heard about us">
          {SOURCES.map((src) => (
            <button
              key={src}
              type="button"
              className="chip chip-sm max-md:!h-11"
              aria-pressed={source === src}
              onClick={() => setSource(source === src ? null : src)}
            >
              {src}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
