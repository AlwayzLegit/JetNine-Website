"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { confirmBlogSubscription } from "./actions";

export function BlogConfirmCard({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
        <h2 className="font-serif text-[26px] font-normal leading-tight text-bone">
          Confirmed. You&rsquo;re on the list.
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
          One email on Fridays with the week&rsquo;s notes from the desk — nothing else, and
          every one carries an unsubscribe link.
        </p>
        <Link href="/blog" className="btn btn-primary mt-8">
          Back to the blog <span className="arrow">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
      <h2 className="font-serif text-[26px] font-normal leading-tight text-bone">
        Confirm your subscription
      </h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-[14px] leading-[1.55] text-steel">
        Nothing is sent until you confirm. If you didn&rsquo;t ask for this, close this page
        and the request expires on its own.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await confirmBlogSubscription(data);
            if (result.ok) setDone(true);
            else if (result.error === "EXPIRED")
              setError("This link has expired. Subscribe again and we'll send a fresh one.");
            else if (result.error === "INVALID") setError("This link is no longer valid.");
            else setError("Something went wrong. Try again in a moment.");
          });
        }}
      >
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary mt-8 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Confirming…" : "Confirm subscription"} <span className="arrow">→</span>
        </button>
      </form>
      {error ? (
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
