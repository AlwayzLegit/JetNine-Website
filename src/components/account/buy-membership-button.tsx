"use client";

import { useState, useTransition } from "react";
import { buyMembership } from "@/app/account/memberships/actions";

// Plain-words copy for the purchase action's error codes.
const ERROR_COPY: Record<string, string> = {
  STRIPE_NOT_CONFIGURED: "Card payments aren't switched on yet — call dispatch.",
  INVALID_PROGRAM: "We don't recognise that program.",
  MEMBER_NOT_FOUND: "Your account isn't set up for memberships yet — call dispatch.",
  ALREADY_ACTIVE: "You already have an active membership.",
  RESERVE_BY_APPLICATION: "Reserve is by application — start from the contact page.",
  STRIPE_ERROR: "Checkout wouldn't open — try again or call dispatch.",
};

/**
 * "Activate →" on a program card. Same Stripe Checkout flow as before;
 * presentation follows the card grammar (44px primary, error sentence).
 */
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
        setError(ERROR_COPY[result.error] ?? "Something went wrong — try again or call dispatch.");
      }
    });
  }

  return (
    <div className="mt-auto flex flex-col gap-2 pt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="btn btn-primary w-full disabled:cursor-wait"
      >
        {busy ? "Opening checkout…" : "Activate"} <span className="arrow">→</span>
      </button>
      {error ? (
        <p role="alert" className="text-[14px] leading-[1.45] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
