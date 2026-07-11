"use client";

// Route-level error boundary for the member portal — keeps a DB hiccup from
// bubbling to the bare global error page and losing the account shell.
export default function AccountError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="container-jn py-24 text-center">
      <p className="caption mb-4">— Account · something went wrong</p>
      <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
        That didn&rsquo;t load.
      </h1>
      <p className="mx-auto mt-4 max-w-[48ch] text-[15px] leading-[1.6] text-bone-2">
        A temporary hiccup on our side — your data is safe. Try again, and if it keeps
        happening, the dispatch line answers 24/7.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={reset} className="btn btn-primary btn-sm">
          Try again <span className="arrow">→</span>
        </button>
        <a href="/account" className="btn btn-ghost btn-sm">
          Back to account
        </a>
      </div>
    </section>
  );
}
