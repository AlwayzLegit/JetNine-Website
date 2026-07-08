"use client";

import { useEffect, useState, type FormEvent } from "react";
import { sendMagicLink } from "./actions";

// Seconds a user must wait before re-requesting a link. Supabase throttles
// repeat sends server-side (and returns no error when it does), so we pace
// the UI to match and, crucially, let the user retry instead of locking the
// form after one send.
const RESEND_COOLDOWN_S = 45;

export function SignInForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down to zero, then re-enable the button.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || cooldown > 0) return;
    setSubmitting(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    try {
      const result = await sendMagicLink(data);
      if (result.ok) {
        setSuccess(result.message);
        setCooldown(RESEND_COOLDOWN_S);
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

  const buttonLabel = submitting
    ? "Sending…"
    : cooldown > 0
      ? `Resend in ${cooldown}s`
      : success
        ? "Resend link"
        : "Email me a link";

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
          disabled={submitting}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || cooldown > 0}
        className="btn btn-primary disabled:cursor-wait disabled:opacity-60"
      >
        {buttonLabel}{" "}
        {!success && !submitting && cooldown === 0 ? <span className="arrow">→</span> : null}
      </button>

      {success ? (
        <div className="rounded-[3px] border border-[var(--success)] bg-[rgba(91,140,90,0.08)] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--success)]">
            {success}
          </p>
          <p className="mt-2 font-mono text-[10px] leading-[1.6] tracking-[0.04em] text-bone-2">
            — Arrives within a minute or two. Open it in <strong>this</strong> device&rsquo;s
            browser. Not there? Check spam/promotions. Links are rate-limited, so wait for the
            timer before resending — still nothing after a few minutes, call dispatch.
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
          — {error}
        </p>
      ) : null}
    </form>
  );
}
