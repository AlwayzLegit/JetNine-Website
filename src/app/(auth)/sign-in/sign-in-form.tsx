"use client";

import { useState, type FormEvent } from "react";
import { sendMagicLink } from "./actions";

export function SignInForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const data = new FormData(e.currentTarget);
    try {
      const result = await sendMagicLink(data);
      if (result.ok) {
        setSuccess(result.message);
      } else {
        setError(result.error);
      }
    } catch {
      // A thrown action (e.g. an auth rate-limit 503 at the edge) must not
      // leave the button stuck on "Sending…" — surface it and re-enable.
      setError("Couldn't send the link just now — wait a moment and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/account"} />
      <div className={`field-jn ${error ? "error" : ""}`}>
        <label htmlFor="si-email">Email</label>
        <input
          id="si-email"
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
        className="btn btn-primary disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Sending…" : success ? "Sent ✓" : "Email me a link"}{" "}
        {!success && !submitting ? <span className="arrow">→</span> : null}
      </button>

      {success ? (
        <p className="rounded-[3px] border border-[var(--success)] bg-[rgba(91,140,90,0.08)] p-4 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--success)]">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
          — {error}
        </p>
      ) : null}
    </form>
  );
}
