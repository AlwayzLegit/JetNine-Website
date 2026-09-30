"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { blogUnsubscribeAction } from "@/app/(marketing)/blog/unsubscribe/actions";

export function BlogUnsubscribeCard({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="card p-10 text-center max-md:p-6">
        <h2 className="title-card">Done. No more digests.</h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">
          The blog is still here whenever you want it — this only stops the emails.
        </p>
        <Link href="/blog" className="btn btn-primary btn-lg mt-8">
          Back to the blog <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-10 text-center max-md:p-6">
      <h2 className="title-card">Stop the weekly digest?</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">
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
          className="btn btn-primary btn-lg mt-8 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Stopping…" : "Stop the emails"} <span className="arrow" aria-hidden="true">→</span>
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
