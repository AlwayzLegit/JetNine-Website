"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { confirmBlogSubscription } from "@/app/(marketing)/blog/confirm/actions";

export function BlogConfirmCard({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="card p-10 text-center max-md:p-6">
        <h2 className="title-card">Confirmed. You&rsquo;re on the list.</h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">
          One email on Fridays with the week&rsquo;s notes from the desk — nothing else, and every
          one carries an unsubscribe link.
        </p>
        <Link href="/blog" className="btn btn-primary btn-lg mt-8">
          Back to the blog <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-10 text-center max-md:p-6">
      <h2 className="title-card">Confirm your subscription</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-[14px] text-steel">
        Nothing is sent until you confirm. If you didn&rsquo;t ask for this, close this page and
        the request expires on its own.
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
          className="btn btn-primary btn-lg mt-8 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Confirming…" : "Confirm subscription"}{" "}
          <span className="arrow" aria-hidden="true">→</span>
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-5 text-[14px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
