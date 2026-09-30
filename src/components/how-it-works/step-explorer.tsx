"use client";

import Link from "next/link";
import { useState } from "react";
import { STEPS } from "./steps";

const LAST = STEPS.length - 1;
const PANEL_ID = "how-it-works-step";

/**
 * Five-step explorer: a sticky numbered list on the left (a horizontal
 * chip strip on phones) and one detail card on the right with Previous /
 * Next. Numbered circles fill with clearance for done and current steps;
 * the last step swaps "Next step" for "Request a quote →".
 */
export function StepExplorer() {
  const [step, setStep] = useState(0);
  const active = STEPS[step];

  return (
    <div className="mt-10 grid grid-cols-1 items-start gap-8 md:grid-cols-[260px_minmax(0,1fr)]">
      {/* Phones: horizontal chip strip, bleeding to the 20px gutters. */}
      <div
        className="-mx-[var(--pad-x)] flex gap-2 overflow-x-auto px-[var(--pad-x)] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Steps"
      >
        {STEPS.map((s, i) => (
          <button
            key={s.short}
            type="button"
            role="tab"
            aria-selected={i === step}
            aria-controls={PANEL_ID}
            onClick={() => setStep(i)}
            className={`chip h-11 flex-none ${i === step ? "is-selected" : ""}`}
          >
            {i + 1} · {s.short}
          </button>
        ))}
      </div>

      {/* Desktop: sticky numbered list. */}
      <ol className="sticky top-24 hidden flex-col gap-1 md:flex" aria-label="Steps">
        {STEPS.map((s, i) => {
          const current = i === step;
          const filled = i <= step;
          return (
            <li key={s.short}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={current ? "step" : undefined}
                aria-controls={PANEL_ID}
                className={[
                  "grid w-full grid-cols-[36px_1fr] items-center gap-3 rounded-[10px] px-[14px] py-3 text-left transition-colors",
                  current ? "bg-surface-2 text-bone" : "text-bone-2 hover:text-bone",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clearance",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border text-[14px] font-semibold",
                    filled ? "border-clearance bg-clearance text-ink" : "border-line-2 text-steel",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[13px] text-steel">{s.label}</span>
                  <span className="block text-[16px] font-medium">{s.short}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <article
        id={PANEL_ID}
        role="tabpanel"
        aria-live="polite"
        className="card min-h-[380px] px-10 py-9 max-md:px-5 max-md:py-6"
      >
        <p className="label-jn">
          Step {step + 1} of {STEPS.length} · {active.label}
        </p>
        <h3 className="mt-[10px] font-serif text-[32px] font-normal leading-[1.15] max-md:text-[28px]">
          {active.title}
        </h3>
        <p className="mt-[14px] max-w-[60ch] text-[17px] text-bone-2">{active.body}</p>
        <div className="mt-7 border-t border-line pt-5">
          <p className="label-jn">{active.metaLabel}</p>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-[10px] text-[15px] sm:grid-cols-2">
            {active.items.map((it) => (
              <li key={it} className="grid grid-cols-[auto_1fr] gap-[10px]">
                <span className="text-clearance" aria-hidden="true">✓</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-7 flex flex-wrap gap-[10px]">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="btn btn-secondary"
            >
              ← Previous
            </button>
          ) : null}
          {step < LAST ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(LAST, s + 1))}
              className="btn btn-primary"
            >
              Next step <span className="arrow" aria-hidden="true">→</span>
            </button>
          ) : (
            <Link href="/quote/mission" className="btn btn-primary">
              Request a quote <span className="arrow" aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
