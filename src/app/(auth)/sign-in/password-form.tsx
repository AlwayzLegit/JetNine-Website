"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { signInWithPassword } from "./actions";

export function PasswordSignInForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email && !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await signInWithPassword(data);
      if (result.ok) {
        // Full navigation, not a router push: the session cookie arrived
        // on the action's response and the account layout reads it on
        // the server.
        window.location.assign(result.next);
        return;
      }
      setError(result.error);
    } catch {
      setError("Couldn't sign in just now — wait a moment and try again.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" data-testid="password-form">
      <input type="hidden" name="next" value={next ?? "/account"} />
      {/* Honeypot — see sign-in-form.tsx. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="pw-company">Company</label>
        <input id="pw-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className={`field-jn ${error ? "error" : ""}`}>
        <label htmlFor="pw-email">Email</label>
        <input
          id="pw-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={submitting}
        />
      </div>
      <PasswordField
        id="pw-password"
        name="password"
        label="Password"
        autoComplete="current-password"
        required
        disabled={submitting}
        error={!!error}
      />

      {error ? (
        <p role="alert" className="text-[14px] leading-[1.5] text-danger">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="btn btn-primary btn-lg w-full disabled:cursor-wait">
        {submitting ? "Signing in…" : "Sign in"} {!submitting ? <span className="arrow">→</span> : null}
      </button>

      <p className="text-[13px] text-steel">
        <Link href="/sign-in/reset" className="text-link">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
