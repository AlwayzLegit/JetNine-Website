"use client";

import { useId, useState, useTransition } from "react";
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
  const emailId = useId();

  const pad = compact ? "p-6" : "p-8 max-md:p-6";

  if (message) {
    return (
      <div className={`card mx-auto max-w-[720px] text-center ${pad}`}>
        <p className="title-card-sm">The Friday digest</p>
        <p role="status" className="mt-2 text-bone-2">
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className={`card mx-auto max-w-[720px] text-center ${pad}`}>
      <h3 className="title-card-sm !text-[22px]">Get the Friday digest.</h3>
      <p className="mx-auto mt-2 max-w-[52ch] text-bone-2">
        One email on Fridays with what published — pricing notes, route intel, operator truth.
        No pitches, unsubscribe any time.
      </p>
      <form
        className="mx-auto mt-[18px] flex max-w-[460px] gap-2 max-md:flex-col"
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
        <div className="field-jn min-w-0 flex-1">
          <label htmlFor={emailId} className="sr-only">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="!h-12"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary !h-12 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Sending…" : "Subscribe"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
