"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { idx: 1, label: "Mission", href: "/quote/mission" },
  { idx: 2, label: "Aircraft & preferences", href: "/quote/aircraft" },
  { idx: 3, label: "Contact", href: "/quote/contact" },
  { idx: 4, label: "Review", href: "/quote/review" },
] as const;

export function QuoteStepper() {
  const pathname = usePathname();
  const currentIdx =
    STEPS.find((s) => pathname === s.href || pathname.startsWith(s.href + "/"))?.idx ?? 1;

  return (
    <div className="border-b border-ink-3 bg-ink py-5">
      <div className="container-jn flex flex-wrap items-center gap-x-6 gap-y-3">
        {STEPS.map((s, i) => {
          const state: "done" | "active" | "pending" =
            s.idx < currentIdx ? "done" : s.idx === currentIdx ? "active" : "pending";
          const clickable = state !== "pending";
          const content = (
            <span
              // Pending state shows muted color via text-steel below;
              // double-dimming with opacity-60 dropped contrast below
              // WCAG AA on the bracket-text color (#7B8290 × 0.6).
              // Cursor-default is still appropriate; opacity is not.
              className={[
                "flex items-center gap-3 transition-colors",
                state === "pending" ? "cursor-default" : "cursor-pointer hover:text-bone",
              ].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] tracking-[0.04em]",
                  state === "done"
                    ? "border border-bone bg-ink text-clearance"
                    : state === "active"
                      ? "bg-clearance text-ink"
                      : "border border-ink-3 bg-ink-3 text-steel",
                ].join(" ")}
              >
                {state === "done" ? "✓" : String(s.idx).padStart(2, "0")}
              </span>
              <span className="flex flex-col leading-tight max-md:hidden">
                <span
                  className={[
                    "font-mono text-[9px] uppercase tracking-[0.14em]",
                    state === "pending" ? "text-steel" : "text-bone-2",
                  ].join(" ")}
                >
                  Step {String(s.idx).padStart(2, "0")}
                </span>
                <span
                  className={[
                    "font-mono text-[11px] uppercase tracking-[0.08em]",
                    state === "pending" ? "text-steel" : "text-bone",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </span>
            </span>
          );
          return (
            <div key={s.idx} className="flex items-center gap-6">
              {clickable ? (
                <Link href={s.href}>{content}</Link>
              ) : (
                content
              )}
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={[
                    "h-px w-6",
                    s.idx < currentIdx ? "bg-clearance" : "bg-ink-3",
                  ].join(" ")}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
