"use client";

import { useState, useTransition } from "react";
import { startInvoiceCheckout } from "@/app/account/invoices/actions";

// Plain-words copy for the checkout action's error codes. The codes
// themselves never reach the page.
const ERROR_COPY: Record<string, string> = {
  STRIPE_NOT_CONFIGURED: "Card payments aren't switched on yet — call dispatch and we'll take it by wire.",
  NOT_FOUND: "We couldn't find that invoice.",
  FORBIDDEN: "This invoice isn't on your account.",
  INVOICE_NOT_PAYABLE: "This invoice can't be paid online right now.",
  INVALID_AMOUNT: "The amount is missing — call dispatch.",
  INVOICE_TOO_LARGE_FOR_STRIPE: "This amount is over the card limit — call dispatch to pay by wire.",
  PAYMENT_IN_PROGRESS: "A payment is already open in another tab. Finish there, or wait a moment and try again.",
  PAYMENT_ALREADY_COMPLETE: "This invoice is already paid — refresh to see it update.",
  STRIPE_ERROR: "Checkout wouldn't open — try again or call dispatch.",
};

/**
 * "Pay →" on an outstanding invoice. Same Stripe Checkout flow as before
 * (claim → session → redirect); only the presentation follows the
 * account card grammar: 44px primary button, error as a sentence.
 */
export function InvoicesPayButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startPending] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || redirecting;

  function onClick() {
    setError(null);
    startPending(async () => {
      const result = await startInvoiceCheckout(invoiceId);
      if (result.ok) {
        setRedirecting(true);
        window.location.assign(result.url);
      } else {
        setError(ERROR_COPY[result.error] ?? "Something went wrong — try again or call dispatch.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="btn btn-primary disabled:cursor-wait"
      >
        {busy ? "Opening checkout…" : "Pay"} <span className="arrow">→</span>
      </button>
      {error ? (
        <p role="alert" className="max-w-[36ch] text-[14px] leading-[1.45] text-danger md:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}
