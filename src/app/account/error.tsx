"use client";

// Route-level error boundary for the member portal — keeps a DB hiccup from
// bubbling to the bare global error page and losing the account shell.
export default function AccountError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card p-8 max-md:p-6">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="title-section">That didn&rsquo;t load.</h1>
      <p className="mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-bone-2">
        A temporary hiccup on our side — your data is safe. Try again, and if it keeps happening, the
        dispatch line answers 24/7.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again <span className="arrow">→</span>
        </button>
        <a href="/account" className="btn btn-secondary">
          Back to account
        </a>
      </div>
    </div>
  );
}
