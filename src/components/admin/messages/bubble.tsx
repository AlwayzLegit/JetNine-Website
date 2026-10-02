import type { ReactNode } from "react";

/**
 * One conversation bubble, as drawn in the Messages prototype. Shared by
 * the live thread (client component) and the read-only call / form panes
 * (server components) — it holds no state.
 *
 *   in    client, left, surface card, radius 12 12 12 4
 *   out   dispatch, right, clearance on ink, radius 12 12 4 12
 *   note  team only, full width, gold-tinted dashed card
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
  const align = kind === "in" ? "items-start" : kind === "out" ? "items-end" : "items-stretch";
  const pad = compact ? "px-3.5 py-2.5" : "px-4 py-3";
  const box =
    kind === "in"
      ? `max-w-[85%] lg:max-w-[70%] rounded-[12px_12px_12px_4px] border border-line bg-surface text-bone ${pad}`
      : kind === "out"
        ? `max-w-[85%] lg:max-w-[70%] rounded-[12px_12px_4px_12px] bg-clearance text-ink ${pad}`
        : `rounded-control border border-dashed border-[rgba(201,162,74,0.4)] bg-[rgba(201,162,74,0.08)] text-bone-2 ${pad}`;
  return (
    <div className={`flex flex-col ${align}`}>
      {kind === "note" && noteLabel ? <div className="mb-1 text-[13px] text-steel">{noteLabel}</div> : null}
      <div className={`${box} ${compact ? "text-[14px]" : "text-[15px]"} whitespace-pre-line leading-[1.5]`}>{children}</div>
      {meta ? <div className="mt-1 text-[13px] text-steel">{meta}</div> : null}
      {footer}
    </div>
  );
}
