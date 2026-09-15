"use client";

import { useState, useTransition } from "react";
import { subscribeToBlog } from "@/app/(marketing)/blog/subscribe/actions";

/**
 * Email capture for the blog. Double opt-in: submitting only sends a
 * confirmation link, so the success copy promises the email, not the
 * subscription. Honeypot field matches the sign-in form's ("company").
 */
export function SubscribeCard({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (message) {
    return (
      <div className={`rounded-[4px] border border-ink-3 bg-ink-2 ${compact ? "p-6" : "p-8"}`}>
        <p className="caption mb-2">— The weekly digest</p>
        <p className="text-[15px] leading-[1.55] text-bone-2">{message}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[4px] border border-ink-3 bg-ink-2 ${compact ? "p-6" : "p-8"}`}>
      <p className="caption mb-2">— The weekly digest</p>
      <h3 className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone">
        The desk writes daily. We&rsquo;ll send you the week.
      </h3>
      <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.55] text-bone-2">
        One email on Fridays with what published — pricing notes, route intel, operator truth.
        No pitches, unsubscribe any time.
      </p>
      <form
        className="mt-5 flex gap-3 max-md:flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await subscribeToBlog(data);
            if (result.ok) setMessage(result.message);
            else setError(result.error);
          });
        }}
      >
        {/* Honeypot — off-screen, never shown to humans. */}
        <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
          <label>
            Company
            <input type="text" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-[3px] border border-ink-3 bg-ink px-4 py-3 text-[15px] text-bone placeholder:text-steel focus:border-clearance focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary whitespace-nowrap disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Sending…" : "Subscribe"} <span className="arrow">→</span>
        </button>
      </form>
      {error ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
