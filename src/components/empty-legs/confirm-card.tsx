"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { confirmWatchlist } from "@/app/(marketing)/empty-legs/confirm/actions";

// One card, three states: ask for the click, confirmed, or an error line.
// The confirmation is a POST so a mail scanner following the link cannot
// opt anyone in — same contract as the action it calls.
export function WatchlistConfirmCard({
  token,
  route,
  window: dateWindow,
}: {
  token: string;
  route: string;
  window: string;
}) {
  const [done, setDone] = useState<"sms" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="card p-10 text-center max-md:p-6">
        <h2 className="title-card">Confirmed. You&rsquo;re on the list.</h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">
          We&rsquo;ll {done === "sms" ? "text" : "email"} you when a repositioning leg matching{" "}
          {route} hits the board. One message per match, nothing else.
          {done === "sms" ? " Reply STOP any time to end them." : ""}
        </p>
        <Link href="/empty-legs" className="btn btn-primary btn-lg mt-8">
          See the board <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-10 text-center max-md:p-6">
      <h2 className="title-card">Confirm your empty-leg alerts</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">
        {route} · {dateWindow}
      </p>
      <p className="mx-auto mt-2 max-w-[52ch] text-[14px] text-steel">
        Nothing is sent until you confirm. If you didn&rsquo;t ask for this, close this page and
        the request is deleted when it expires.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await confirmWatchlist(data);
            if (result.ok) setDone(result.channel);
            else if (result.error === "EXPIRED")
              setError("This link has expired. Set the watchlist up again.");
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
          {pending ? "Confirming…" : "Confirm alerts"} <span className="arrow" aria-hidden="true">→</span>
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
