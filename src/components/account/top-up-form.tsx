"use client";

import { useState, useTransition } from "react";
import { topUpMembership } from "@/app/account/memberships/actions";

const PRESETS = [25_000, 50_000, 100_000] as const;
const MIN_USD = 5_000;
const MAX_USD = 1_000_000;

const ERROR_COPY: Record<string, string> = {
  STRIPE_NOT_CONFIGURED: "Card payments aren't switched on yet — call dispatch.",
  INVALID_AMOUNT: `Choose an amount between $${MIN_USD.toLocaleString()} and $${MAX_USD.toLocaleString()}.`,
  MEMBER_NOT_FOUND: "Your account isn't set up for memberships yet — call dispatch.",
  NO_ACTIVE_MEMBERSHIP: "There's no active card to top up.",
  STRIPE_ERROR: "Checkout wouldn't open — try again or call dispatch.",
};

/**
 * Top up the reserve balance. Same validation and Stripe Checkout flow
 * as before; presets are chips, the amount is a `.field-jn`, the submit
 * is the 52px primary.
 */
export function TopUpForm() {
  const [pending, startPending] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(PRESETS[0]);
  const busy = pending || redirecting;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(amount) || amount < MIN_USD || amount > MAX_USD) {
      setError(ERROR_COPY.INVALID_AMOUNT);
      return;
    }
    startPending(async () => {
      const result = await topUpMembership(amount);
      if (result.ok) {
        setRedirecting(true);
        window.location.assign(result.url);
      } else {
        setError(ERROR_COPY[result.error] ?? "Something went wrong — try again or call dispatch.");
      }
    });
  }

  return (
    <section className="card card-pad">
      <h2 className="title-card-sm text-bone">Top up your balance</h2>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.55] text-bone-2">
        Add funds to your existing card. Same locked rates, same call-out window — the balance
        just lasts longer. Refundable, like the original deposit.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Preset amounts">
          {PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              aria-pressed={amount === v}
              className="chip"
            >
              ${v.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="field-jn max-w-[320px]">
          <label htmlFor="topup-amount">Amount (USD)</label>
          <input
            id="topup-amount"
            type="number"
            inputMode="numeric"
            min={MIN_USD}
            max={MAX_USD}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Number.parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className="btn btn-primary btn-lg disabled:cursor-wait">
            {busy ? "Opening checkout…" : `Top up ${Number.isFinite(amount) && amount > 0 ? `$${amount.toLocaleString()}` : ""}`}{" "}
            <span className="arrow">→</span>
          </button>
          {error ? (
            <p role="alert" className="text-[14px] leading-[1.45] text-danger">
              {error}
            </p>
          ) : (
            <p className="text-[14px] leading-[1.45] text-steel">
              Checkout opens in this window. The receipt lands in your inbox.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
