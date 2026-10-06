export type TimelineStep = {
  title: string;
  note?: string | null;
  state: "done" | "current" | "upcoming";
};

/**
 * Vertical timeline from the Light "Request received" panel (Quote.dc
 * step 3): 24px circles — navy with ✓ when done, white with a bronze ring
 * for the current step, a line ring for upcoming — joined by a 1px rule.
 */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="mt-[22px] flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.title} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3.5">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={[
                  "flex h-6 w-6 flex-none items-center justify-center rounded-full border-[1.5px] text-[12px] font-semibold",
                  s.state === "done"
                    ? "border-clearance bg-clearance text-white"
                    : s.state === "current"
                      ? "border-gold bg-surface text-bone"
                      : "border-line bg-surface",
                ].join(" ")}
              >
                {s.state === "done" ? "✓" : null}
              </span>
              {last ? null : <span aria-hidden className="min-h-[22px] w-px flex-1 bg-line" />}
            </div>
            <div className="pb-4">
              <div
                className={[
                  "text-[16px] font-semibold leading-[1.4]",
                  s.state === "upcoming" ? "text-steel" : "text-bone",
                ].join(" ")}
              >
                {s.title}
                <span className="sr-only">
                  {s.state === "done" ? " (done)" : s.state === "current" ? " (in progress)" : ""}
                </span>
              </div>
              {s.note ? <div className="text-[14px] text-steel">{s.note}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type ProgressState = "done" | "now" | "todo";

/**
 * The horizontal four-step strip under the request title (Your
 * request.dc): 22px circles — bronze with ✓ when done, a sand dot ring
 * for the current step, a line ring for upcoming.
 */
export function ProgressStrip({ steps }: { steps: { label: string; state: ProgressState }[] }) {
  return (
    <ol className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3 rounded-[3px] border border-line bg-surface px-[18px] py-3.5">
      {steps.map((s) => (
        <li
          key={s.label}
          className={["flex items-center gap-2.5 text-[13px]", s.state === "todo" ? "text-steel" : "text-bone"].join(" ")}
          aria-current={s.state === "now" ? "step" : undefined}
        >
          <span
            aria-hidden
            className={[
              "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border text-[12px] font-bold",
              s.state === "done"
                ? "border-gold bg-gold text-white"
                : s.state === "now"
                  ? "border-gold bg-surface-2 text-gold"
                  : "border-line bg-transparent",
            ].join(" ")}
          >
            {s.state === "done" ? "✓" : s.state === "now" ? "●" : ""}
          </span>
          {s.label}
          <span className="sr-only">{s.state === "done" ? " — done" : s.state === "now" ? " — now" : ""}</span>
        </li>
      ))}
    </ol>
  );
}
