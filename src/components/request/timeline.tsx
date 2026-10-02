export type TimelineStep = {
  title: string;
  note?: string | null;
  state: "done" | "current" | "upcoming";
};

/** Vertical 4-step timeline: ✓ filled clearance, gold ring, outlined. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="mt-7 flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.title} className="grid grid-cols-[28px_1fr] gap-4">
            <span
              aria-hidden
              className={[
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold",
                s.state === "done"
                  ? "bg-clearance text-ink"
                  : s.state === "current"
                    ? "border-2 border-gold bg-surface"
                    : "border border-line-2 bg-surface",
              ].join(" ")}
            >
              {s.state === "done" ? "✓" : s.state === "current" ? (
                <span className="h-2.5 w-2.5 rounded-full bg-gold" />
              ) : null}
            </span>
            <div
              className={[
                "-ml-[30px] pl-[30px]",
                last ? "" : "border-l border-line-2 pb-6",
              ].join(" ")}
            >
              <div
                className={[
                  "text-[17px]",
                  s.state === "upcoming" ? "text-bone-2" : "font-medium text-bone",
                ].join(" ")}
              >
                {s.title}
              </div>
              {s.note ? (
                <div className={["text-[14px]", s.state === "current" ? "text-bone-2" : "text-steel"].join(" ")}>
                  {s.note}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
