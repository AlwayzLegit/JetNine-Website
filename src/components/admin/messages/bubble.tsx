import type { ReactNode } from "react";

/**
 * One conversation bubble, as drawn in the Messages prototype. Shared by
 * the live thread (client component) and the read-only call / form panes
 * (server components) — it holds no state.
 *
 *   in    client, left, white card, radius 8 8 8 0
 *   out   dispatch, right, sand card, radius 8 8 0 8
 *   note  team only, right, bronze-tinted card (Light prototype)
 */
export type BubbleKind = "in" | "out" | "note";

export function Bubble({
  kind,
  children,
  meta,
  footer,
  compact = false,
  noteLabel = "Not sent — shows in the client’s account",
}: {
  kind: BubbleKind;
  /** Caption above a note bubble; system lines pass "Only the team sees this". */
  noteLabel?: ReactNode;
  children: ReactNode;
  /** "Dana · text · 10 min ago" */
  meta?: ReactNode;
  /** Delivery line under the bubble (danger / steel). */
  footer?: ReactNode;
  compact?: boolean;
}) {
  const align = kind === "in" ? "items-start" : "items-end";
  const pad = compact ? "px-3 py-2" : "px-3.5 py-2.5";
  const box =
    kind === "in"
      ? `max-w-[92%] lg:max-w-[70%] rounded-[8px_8px_8px_0] border border-line bg-surface text-bone ${pad}`
      : kind === "out"
        ? `max-w-[92%] lg:max-w-[70%] rounded-[8px_8px_0_8px] border border-line bg-surface-2 text-bone ${pad}`
        : `max-w-[92%] lg:max-w-[70%] rounded-[8px_8px_0_8px] border border-[#C9A98A] bg-[#F1EADF] text-bone ${pad}`;
  return (
    <div className={`flex flex-col ${align}`}>
      {kind === "note" && noteLabel ? <div className="mb-1 text-[12px] text-steel">{noteLabel}</div> : null}
      <div className={`${box} ${compact ? "text-[13px]" : "text-[14px]"} whitespace-pre-line leading-[1.45]`}>{children}</div>
      {meta ? <div className="mt-1 text-[12px] text-steel">{meta}</div> : null}
      {footer}
    </div>
  );
}
