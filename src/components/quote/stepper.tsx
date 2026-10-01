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

// Four-column step bar under the quote header. 28px number circle —
// clearance-filled for done and current steps, outlined for upcoming —
// then "Step n of 4" in steel over the step name. The current step gets a
// 2px clearance bottom border. A step is a link only once everything
// before it is complete (the store's step guards); otherwise it is inert.
// Phones keep the circles and the current step's name only.
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
    <nav aria-label="Steps" className="border-b border-line-faint bg-ink">
      <ol className="container-jn flex gap-2 md:grid md:grid-cols-4">
        {STEPS.map((s) => {
          const state: "done" | "current" | "upcoming" =
            s.idx < currentIdx ? "done" : s.idx === currentIdx ? "current" : "upcoming";
          const isLink = reachable[s.idx - 1] || state === "current";

          const inner = (
            <>
              <span
                aria-hidden="true"
                className={[
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full border text-[13px] font-semibold",
                  state === "upcoming"
                    ? "border-line-2 text-steel"
                    : "border-clearance bg-clearance text-ink",
                ].join(" ")}
              >
                {s.idx}
              </span>
              <span
                className={[
                  "flex flex-col leading-[1.25]",
                  state === "current" ? "" : "max-md:sr-only",
                ].join(" ")}
              >
                <span className="text-[12px] text-steel max-md:sr-only">Step {s.idx} of 4</span>
                <span
                  className={[
                    "text-[15px] font-medium",
                    state === "current" ? "text-bone" : "text-bone-2",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </span>
            </>
          );

          const itemClass = [
            "flex min-h-[56px] w-full items-center gap-3 border-b-2 px-1 py-3.5 text-left",
            state === "current" ? "border-clearance" : "border-transparent",
            isLink ? "transition-colors hover:text-bone" : "cursor-default",
          ].join(" ");

          return (
            <li
              key={s.idx}
              className={state === "current" ? "min-w-0 max-md:flex-1" : "max-md:flex-none"}
            >
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
    </nav>
  );
}
