"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { blogUnsubscribeAction } from "./actions";

export function BlogUnsubscribeCard({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
        <h1 className="font-serif text-[26px] font-normal leading-tight text-bone">
          Done. No more digests.
        </h1>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
          The blog is still here whenever you want it — this only stops the emails.
        </p>
        <Link href="/blog" className="btn btn-primary mt-8">
          Back to the blog <span className="arrow">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
      <h1 className="font-serif text-[26px] font-normal leading-tight text-bone">
        Stop the weekly digest?
      </h1>
      <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
        One click and the emails stop. You can re-subscribe on the blog any time.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await blogUnsubscribeAction(data);
            if (result.ok) setDone(true);
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
          {pending ? "Stopping…" : "Stop the emails"} <span className="arrow">→</span>
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
