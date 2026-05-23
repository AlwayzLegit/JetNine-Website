"use client";

import { useState, useTransition } from "react";
import { topUpMembership } from "@/app/account/memberships/actions";

const PRESETS = [25_000, 50_000, 100_000] as const;
const MIN_USD = 5_000;
const MAX_USD = 1_000_000;

const ERROR_COPY: Record<string, string> = {
  STRIPE_NOT_CONFIGURED: "Payments not enabled — call dispatch.",
  INVALID_AMOUNT: `Amount must be between $${MIN_USD.toLocaleString()} and $${MAX_USD.toLocaleString()}.`,
  MEMBER_NOT_FOUND: "Account not provisioned — call dispatch.",
  NO_ACTIVE_MEMBERSHIP: "No active card to top up.",
  STRIPE_ERROR: "Stripe couldn't open checkout — try again or call dispatch.",
};

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
        setError(ERROR_COPY[result.error] ?? result.error);
      }
    });
  }

  return (
    <section className="mt-14">
      <p className="caption mb-3">— Top up balance</p>
      <p className="mb-5 max-w-[60ch] text-[13px] leading-[1.55] text-bone-2">
        Add funds to your existing card. Same hourly rates, same callout window — the balance just
        keeps the lights on longer. Refundable like the original deposit.
      </p>
      <form
        onSubmit={onSubmit}
        className="rounded-[4px] border border-ink-3 bg-ink-2 p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              className={[
                "rounded-[3px] border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                amount === v
                  ? "border-clearance bg-ink text-clearance"
                  : "border-ink-3 bg-ink text-bone-2 hover:border-bone-2 hover:text-bone",
              ].join(" ")}
            >
              ${(v / 1000).toLocaleString()}k
            </button>
          ))}
          <div className="field-jn !mb-0 ml-2 flex-1 min-w-[200px]">
            <label htmlFor="topup-amount" className="sr-only">
              Custom amount (USD)
            </label>
            <input
              id="topup-amount"
              type="number"
              inputMode="numeric"
              min={MIN_USD}
              max={MAX_USD}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(Number.parseInt(e.target.value, 10) || 0)}
              className="w-full"
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {error ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--error)]">
              {error}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Stripe Checkout opens in this window. Receipt lands in your inbox.
            </span>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Opening checkout…" : `Top up $${amount.toLocaleString()}`}{" "}
            <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </section>
  );
}
