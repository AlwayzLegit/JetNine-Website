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
  /** Primary 52px button — a link when `href` is set, a button otherwise. */
  next?: NextAction;
  /** Step 1 only: "Cancel" link back to the site. */
  cancelHref?: string;
  /** Optional inline validation sentence, shown above the row in danger. */
  error?: string | null;
};

// Footer row under every step: "Step n of 4 · Draft saves automatically"
// on the left, Cancel / ← Back and the primary button on the right, over
// a line border. On phones the row pins to the bottom of the viewport on
// an ink background (the layout pads the page so nothing hides under it)
// and the status text gives way to the two actions.
export function StepFooter({ step, backHref, backLabel = "← Back", next, cancelHref, error }: Props) {
  const nextClass = "btn btn-primary btn-lg max-md:flex-1";
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

  return (
    <div className="mt-8 border-t border-line pt-6 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:mt-0 max-md:border-line-faint max-md:bg-ink max-md:px-[var(--pad-x)] max-md:pb-[calc(12px+env(safe-area-inset-bottom))] max-md:pt-3">
      {error ? (
        <p role="alert" className="mb-4 text-[14px] text-danger max-md:mb-2">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] text-steel max-md:hidden">
          Step {step} of 4 · <SavedIndicator />
        </span>
        <div className="flex items-center gap-5 max-md:w-full">
          {cancelHref ? (
            <Link
              href={cancelHref}
              className="inline-flex h-11 items-center text-[15px] text-bone-2 transition-colors hover:text-bone"
            >
              Cancel
            </Link>
          ) : null}
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-11 items-center whitespace-nowrap text-[15px] text-bone-2 transition-colors hover:text-bone"
            >
              {backLabel}
            </Link>
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
        </div>
      </div>
    </div>
  );
}
