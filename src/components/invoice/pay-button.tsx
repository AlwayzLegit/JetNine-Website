"use client";

import { useState, useTransition } from "react";
import { startInvoiceCheckout } from "@/app/account/invoices/actions";

const ERROR_COPY: Record<string, string> = {
  STRIPE_NOT_CONFIGURED: "Payments not yet enabled — call dispatch.",
  NOT_FOUND: "Invoice not found.",
  FORBIDDEN: "You can't pay this invoice.",
  INVOICE_NOT_PAYABLE: "This invoice isn't payable right now.",
  INVALID_AMOUNT: "Amount missing — call dispatch.",
  STRIPE_ERROR: "Stripe couldn't open checkout — try again or call dispatch.",
};

export function PayInvoiceButton({
  invoiceId,
  className = "",
}: {
  invoiceId: string;
  className?: string;
}) {
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
        setError(ERROR_COPY[result.error] ?? result.error);
      }
    });
  }

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Opening…" : "Pay now"} <span className="arrow">→</span>
      </button>
      {error ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
