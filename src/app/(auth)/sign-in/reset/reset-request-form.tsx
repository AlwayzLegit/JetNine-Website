"use client";

import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "../actions";

export function ResetRequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const result = await requestPasswordReset(data);
      if (result.ok) setSuccess(result.message);
      else setError(result.error);
    } catch {
      setError("Couldn't send the link just now — wait a moment and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" data-testid="reset-request-form">
      {/* Honeypot — see sign-in-form.tsx. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="rr-company">Company</label>
        <input id="rr-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className={`field-jn ${error ? "error" : ""}`}>
        <label htmlFor="rr-email">Email</label>
        <input
          id="rr-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={submitting || !!success}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !!success}
        className="btn btn-primary btn-lg w-full disabled:cursor-wait"
      >
        {submitting ? "Sending…" : success ? "Link sent" : "Email me a reset link"}{" "}
        {!success && !submitting ? <span className="arrow">→</span> : null}
      </button>

      {success ? (
        <div role="status" className="border border-line bg-surface-2 p-4">
          <p className="text-[15px] font-medium leading-[1.5] text-success">{success}</p>
          <p className="mt-2 text-[14px] leading-[1.6] text-bone-2">
            It arrives within a minute or two. Not there? Check spam or promotions. Still nothing
            after a few minutes, call dispatch.
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[14px] leading-[1.5] text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
