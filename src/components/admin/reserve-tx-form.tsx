"use client";

import { useState, useTransition, type FormEvent } from "react";
import { appendReserveTransaction } from "@/app/admin/clients/[id]/actions";
import { formatUSD } from "@/lib/quote-pricing";

const KINDS = [
  { id: "top_up", label: "Deposit", note: "money in" },
  { id: "credit_accrual", label: "Cashback", note: "money in, after the flight" },
  { id: "refund", label: "Refund", note: "money in" },
  { id: "charter_draw", label: "Charter payment", note: "money out" },
  { id: "adjustment", label: "Adjustment", note: "either way — type the sign" },
] as const;

/**
 * Add a ledger entry for a client's reserve. Same `appendReserveTransaction`
 * action and fields as before (kind / amount / description); the sign still
 * follows the kind on the server.
 */
export function ReserveTxForm({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setMsg(null);

    startTransition(async () => {
      const result = await appendReserveTransaction(memberId, data);
      if (result.ok) {
        setMsg({ tone: "ok", text: `Posted. The balance is now ${formatUSD(result.balanceUsd)}.` });
        form.reset();
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <div className="field-jn">
        <label htmlFor="rtx-kind">What happened</label>
        <select id="rtx-kind" name="kind" defaultValue="top_up" required>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} — {k.note}
            </option>
          ))}
        </select>
      </div>
      <div className="field-jn">
        <label htmlFor="rtx-amount">Amount in dollars</label>
        <input
          id="rtx-amount"
          name="amount"
          type="number"
          step="1"
          min={-5000000}
          max={5000000}
          placeholder="50000"
          required
        />
      </div>
      <div className="field-jn">
        <label htmlFor="rtx-description">Note (optional)</label>
        <input
          id="rtx-description"
          name="description"
          type="text"
          placeholder="Wire received, ref 88421"
          maxLength={200}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {msg ? (
          <p className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`} role="status">
            {msg.text}
          </p>
        ) : (
          <p className="text-[14px] text-steel">Money in is added, a charter payment is taken off.</p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Posting…" : "Post the entry"}
        </button>
      </div>
    </form>
  );
}
