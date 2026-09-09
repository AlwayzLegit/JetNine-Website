"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unsubscribeAction } from "./actions";

export function UnsubscribeCard({
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
      <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
        <h2 className="font-serif text-[26px] font-normal leading-tight text-bone">
          {done === "all" ? "All alerts stopped." : "Email alerts stopped."}
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
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
            className="btn btn-secondary mt-8 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Stopping…" : "Stop the texts as well"} <span className="arrow">→</span>
          </button>
        ) : (
          <Link href="/empty-legs" className="btn btn-primary mt-8">
            Back to the board <span className="arrow">→</span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
      <h2 className="font-serif text-[26px] font-normal leading-tight text-bone">
        Stop empty-leg alerts
      </h2>
      <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
        {route}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => submit("email")}
          disabled={pending}
          className="btn btn-primary disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Stopping…" : "Stop email alerts"} <span className="arrow">→</span>
        </button>
        {hasSms ? (
          <button
            type="button"
            onClick={() => submit("all")}
            disabled={pending}
            className="btn btn-secondary disabled:cursor-wait disabled:opacity-60"
          >
            Stop email and texts
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
          Something went wrong. Try again in a moment.
        </p>
      ) : null}
    </div>
  );
}
