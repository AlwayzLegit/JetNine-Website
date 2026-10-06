"use client";

import Link from "next/link";
import { SavedIndicator } from "./saved-indicator";

type NextAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type Props = {
  step: 1 | 2 | 3 | 4;
  /** Previous step; rendered as a "← Back" text link. */
  backHref?: string;
  backLabel?: string;
  /** Primary full-width 48px button — a link when `href` is set, a button otherwise. */
  next?: NextAction;
  /** Step 1 only: "Cancel" link back to the site. */
  cancelHref?: string;
  /** Optional inline validation sentence, shown above the button in danger. */
  error?: string | null;
};

// Footer of every step panel (Quote.dc): the full-width navy button, then
// a 13px steel row — "An inquiry is not a confirmed booking." and the
// draft-saved word on the left, Cancel / ← Back on the right.
export function StepFooter({ step, backHref, backLabel = "← Back", next, cancelHref, error }: Props) {
  const nextClass = "btn btn-primary !h-12 w-full !text-[16px]";
  const nextInner = (
    <>
      {next?.loading ? "Sending…" : next?.label}
      {!next?.loading ? (
        <span className="arrow" aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );
  const linkClass =
    "inline-flex min-h-11 items-center whitespace-nowrap text-[14px] text-steel underline underline-offset-[3px] transition-colors hover:text-bone";

  return (
    <div className={next ? "mt-[18px]" : "mt-6 border-t border-line pt-2"}>
      {error ? (
        <p role="alert" className="mb-3 text-[14px] text-danger">
          {error}
        </p>
      ) : null}
      {next ? (
        next.href && !next.disabled && !next.loading ? (
          <Link href={next.href} className={nextClass} onClick={next.onClick}>
            {nextInner}
          </Link>
        ) : (
          <button
            type="button"
            className={nextClass}
            onClick={next.onClick}
            disabled={next.disabled || next.loading}
            aria-busy={next.loading || undefined}
          >
            {nextInner}
          </button>
        )
      ) : null}
      <div className="mt-1.5 flex items-center justify-between gap-4 text-[13px] text-steel">
        <span>
          An inquiry is not a confirmed booking.
          <span className="max-sm:hidden">
            {" "}
            · <SavedIndicator />
          </span>
          <span className="sr-only"> Step {step} of 4.</span>
        </span>
        <span className="flex items-center gap-4">
          {backHref ? (
            <Link href={backHref} className={linkClass}>
              {backLabel}
            </Link>
          ) : null}
          {cancelHref ? (
            <Link href={cancelHref} className={linkClass}>
              Cancel
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  );
}
