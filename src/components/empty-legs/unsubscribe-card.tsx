"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unsubscribeAction } from "@/app/(marketing)/empty-legs/unsubscribe/actions";

export function WatchlistUnsubscribeCard({
  token,
  route,
  hasSms,
}: {
  token: string;
  route: string;
  hasSms: boolean;
}) {
  const [done, setDone] = useState<"email" | "all" | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(scope: "email" | "all") {
    const data = new FormData();
    data.set("token", token);
    data.set("scope", scope);
    setError(false);
    startTransition(async () => {
      const result = await unsubscribeAction(data);
      if (result.ok) setDone(scope);
      else setError(true);
    });
  }

  if (done) {
    return (
      <div className="card p-10 text-center max-md:p-6">
        <h2 className="title-card">
          {done === "all" ? "All alerts stopped." : "Email alerts stopped."}
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">
          {done === "all"
            ? "We won't email or text you about this watchlist again."
            : hasSms
              ? "No more emails about this watchlist. Texts are still on — reply STOP to any of them to end those too."
              : "No more emails about this watchlist."}
        </p>
        {done === "email" && hasSms ? (
          <button
            type="button"
            onClick={() => submit("all")}
            disabled={pending}
            className="btn btn-secondary btn-lg mt-8 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Stopping…" : "Stop the texts as well"}
          </button>
        ) : (
          <Link href="/empty-legs" className="btn btn-primary btn-lg mt-8">
            Back to the board <span className="arrow" aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="card p-10 text-center max-md:p-6">
      <h2 className="title-card">Stop empty-leg alerts</h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">{route}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => submit("email")}
          disabled={pending}
          className="btn btn-primary btn-lg disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Stopping…" : "Stop email alerts"} <span className="arrow" aria-hidden="true">→</span>
        </button>
        {hasSms ? (
          <button
            type="button"
            onClick={() => submit("all")}
            disabled={pending}
            className="btn btn-secondary btn-lg disabled:cursor-wait disabled:opacity-60"
          >
            Stop email and texts
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-5 text-[14px] text-danger">
          Something went wrong. Try again in a moment.
        </p>
      ) : null}
    </div>
  );
}
