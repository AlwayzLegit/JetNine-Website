"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isAircraftComplete,
  isContactComplete,
  isMissionComplete,
  useQuoteStore,
} from "@/lib/quote-store";

const STEPS = [
  { idx: 1, label: "Mission", href: "/quote/mission" },
  { idx: 2, label: "Aircraft & preferences", href: "/quote/aircraft" },
  { idx: 3, label: "Contact", href: "/quote/contact" },
  { idx: 4, label: "Review", href: "/quote/review" },
] as const;

// Slim four-segment progress bar above the step panel (the Light flow
// has no heavy step bar — Quote.dc carries "Step n of 2" in the lead).
// Each step is a 3px rule — navy for done and current, line for
// upcoming — with "1 · Mission" under it; phones show the current
// step's name only. A step is a link only once everything before it is
// complete (the store's step guards); otherwise it is inert.
//
// Reading the store here is SSR-safe: hydration is skipped until the
// StoreHydrationGate rehydrates, so server and first client render both
// see the defaults (every guard false), then the links appear.
export function QuoteStepper() {
  const pathname = usePathname();
  const draft = useQuoteStore();
  const currentIdx =
    STEPS.find((s) => pathname === s.href || pathname.startsWith(s.href + "/"))?.idx ?? 1;

  const missionDone = isMissionComplete(draft);
  const aircraftDone = missionDone && isAircraftComplete(draft);
  const contactDone = aircraftDone && isContactComplete(draft);
  const reachable = [true, missionDone, aircraftDone, contactDone];

  return (
    <nav aria-label="Steps" className="mb-5">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s) => {
          const state: "done" | "current" | "upcoming" =
            s.idx < currentIdx ? "done" : s.idx === currentIdx ? "current" : "upcoming";
          const isLink = reachable[s.idx - 1] || state === "current";

          const inner = (
            <>
              <span
                aria-hidden="true"
                className={[
                  "block h-[3px] w-full rounded-[2px]",
                  state === "upcoming" ? "bg-line" : "bg-clearance",
                ].join(" ")}
              />
              <span
                className={[
                  "mt-2 block truncate text-[13px] leading-[1.35]",
                  "max-md:sr-only",
                  state === "current" ? "font-semibold text-bone" : "text-steel",
                ].join(" ")}
              >
                {s.idx} · {s.label}
              </span>
            </>
          );

          const itemClass = [
            "block w-full pt-2 text-left md:min-h-11 max-md:h-6",
            isLink && state !== "current" ? "transition-colors hover:[&>span:last-child]:text-bone" : "",
            isLink ? "" : "cursor-default",
          ].join(" ");

          return (
            <li key={s.idx} className="min-w-0">
              {isLink ? (
                <Link
                  href={s.href}
                  className={itemClass}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={`Step ${s.idx} of 4: ${s.label}`}
                >
                  {inner}
                </Link>
              ) : (
                <span className={itemClass} aria-label={`Step ${s.idx} of 4: ${s.label}, not yet available`}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p aria-hidden="true" className="mt-1 text-[13px] text-bone md:hidden">
        <span className="font-semibold">Step {currentIdx} of 4</span> ·{" "}
        {STEPS[currentIdx - 1]?.label}
      </p>
    </nav>
  );
}
