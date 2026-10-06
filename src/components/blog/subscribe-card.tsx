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

  // Light grammar: a white ruled box, serif title + one line on the left,
  // the field and a navy button on the right; stacks on phones.
  const box = `border border-line bg-white ${compact ? "p-5" : "p-6 max-md:p-5"}`;

  if (message) {
    return (
      <div className={box}>
        <p className="eyebrow !mb-1">The Friday digest</p>
        <p role="status" className="font-serif text-[20px] leading-[1.3]">
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className={`${box} flex flex-wrap items-center justify-between gap-x-8 gap-y-4`}>
      <div className={`min-w-0 ${compact ? "basis-full" : "flex-[1_1_320px]"}`}>
        <p className="eyebrow !mb-1">The Friday digest</p>
        <h3 className="font-serif text-[26px] font-normal leading-[1.15]">Get the Friday digest.</h3>
        <p className="mt-[6px] max-w-[52ch] text-[14px] leading-[1.5] text-steel">
          One email on Fridays with what published — pricing notes, route intel, operator truth.
          No pitches, unsubscribe any time.
        </p>
      </div>
      <div className={`min-w-0 ${compact ? "basis-full" : "flex-[1_1_360px]"}`}>
        <form
          className="flex gap-2 max-sm:flex-col"
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
            <input id={emailId} type="email" name="email" required autoComplete="email" placeholder="you@example.com" className="!h-11" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary flex-none disabled:cursor-wait disabled:opacity-60">
            {pending ? "Sending…" : "Subscribe"}
          </button>
        </form>
        {error ? (
          <p role="alert" className="mt-3 text-[14px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
