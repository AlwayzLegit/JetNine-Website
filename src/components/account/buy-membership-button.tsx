"use client";

import { useState, useTransition } from "react";
import { buyMembership } from "@/app/account/memberships/actions";

const ERROR_COPY: Record<string, string> = {
  STRIPE_NOT_CONFIGURED: "Payments not enabled — call dispatch.",
  INVALID_PROGRAM: "Unknown tier.",
  MEMBER_NOT_FOUND: "Account not provisioned — call dispatch.",
  ALREADY_ACTIVE: "You already have an active membership.",
  RESERVE_BY_APPLICATION: "Reserve is by application — start at /contact.",
  STRIPE_ERROR: "Stripe couldn't open checkout — try again or call dispatch.",
};

export function BuyMembershipButton({ program }: { program: string }) {
  const [pending, startPending] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || redirecting;

  function onClick() {
    setError(null);
    startPending(async () => {
      const result = await buyMembership(program);
      if (result.ok) {
        setRedirecting(true);
        window.location.assign(result.url);
      } else {
        setError(ERROR_COPY[result.error] ?? result.error);
      }
    });
  }

  return (
    <div className="mt-auto flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="btn btn-primary btn-sm w-full disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Opening checkout…" : "Activate"} <span className="arrow">→</span>
      </button>
      {error ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
