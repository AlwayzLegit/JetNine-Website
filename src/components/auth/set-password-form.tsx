"use client";

import { useState, type FormEvent } from "react";
import { NewPasswordFields } from "./new-password-fields";
import { updatePassword } from "@/app/(auth)/sign-in/actions";

type Props = {
  /** Prefix for the field ids so two forms on a page never collide. */
  idPrefix: string;
  submitLabel: string;
  /** Full navigation after a save (the reset page goes to /account). */
  redirectTo?: string;
  /** Shown in place of the form after a save when there is no redirect. */
  savedMessage?: string;
};

/**
 * New password + confirm, posted to `updatePassword`. The reset page
 * redirects on success; the account panel stays put and says "Saved."
 */
export function SetPasswordForm({ idPrefix, submitLabel, redirectTo, savedMessage }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const result = await updatePassword(data);
      if (result.ok) {
        if (redirectTo) {
          window.location.assign(redirectTo);
          return;
        }
        // The saved line replaces the form, which drops the typed values.
        setSaved(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Couldn't save that just now — wait a moment and try again.");
    }
    setSubmitting(false);
  }

  if (saved && savedMessage) {
    return (
      <p role="status" className="text-[15px] font-medium leading-[1.5] text-success">
        {savedMessage}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <NewPasswordFields idPrefix={idPrefix} disabled={submitting} />
      {error ? (
        <p role="alert" className="text-[14px] leading-[1.5] text-danger">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={submitting} className="btn btn-primary btn-lg w-full disabled:cursor-wait">
        {submitting ? "Saving…" : submitLabel} {!submitting ? <span className="arrow">→</span> : null}
      </button>
    </form>
  );
}
