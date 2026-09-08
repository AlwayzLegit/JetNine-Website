"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { confirmWatchlist } from "./actions";

export function ConfirmCard({
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
      <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
        <h2 className="font-serif text-[26px] font-normal leading-tight text-bone">
          Confirmed. You&rsquo;re on the list.
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
          We&rsquo;ll {done === "sms" ? "text" : "email"} you when a repositioning leg matching{" "}
          {route} hits the board. One message per match, nothing else.
          {done === "sms" ? " Reply STOP any time to end them." : ""}
        </p>
        <Link href="/empty-legs" className="btn btn-primary mt-8">
          See the board <span className="arrow">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
      <h2 className="font-serif text-[26px] font-normal leading-tight text-bone">
        Confirm your empty-leg alerts
      </h2>
      <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
        {route} · {dateWindow}
      </p>
      <p className="mx-auto mt-3 max-w-[52ch] text-[14px] leading-[1.55] text-steel">
        Nothing is sent until you confirm. If you didn&rsquo;t ask for this, close this page
        and the request is deleted when it expires.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await confirmWatchlist(data);
            if (result.ok) setDone(result.channel);
            else if (result.error === "EXPIRED") setError("This link has expired. Set the watchlist up again.");
            else if (result.error === "INVALID") setError("This link is no longer valid.");
            else setError("Something went wrong. Try again in a moment.");
          });
        }}
      >
        <input type="hidden" name="token" value={token} />
        <button type="submit" disabled={pending} className="btn btn-primary mt-8 disabled:cursor-wait disabled:opacity-60">
          {pending ? "Confirming…" : "Confirm alerts"} <span className="arrow">→</span>
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
