"use client";

import { useState, useTransition, type FormEvent } from "react";
import { appendReserveTransaction } from "@/app/admin/member/[id]/actions";

const KINDS = [
  { id: "top_up", label: "Top-up", desc: "+ inflow (deposit, wire received)" },
  { id: "credit_accrual", label: "Cashback", desc: "+ inflow (T+24h after wheels-down)" },
  { id: "refund", label: "Refund", desc: "+ inflow (return to member)" },
  { id: "charter_draw", label: "Charter draw", desc: "− outflow (trip payment)" },
  { id: "adjustment", label: "Adjustment", desc: "± signed manual entry" },
] as const;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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
        setMsg({
          tone: "ok",
          text: `POSTED — BALANCE ${usd.format(result.balanceUsd)}`,
        });
        form.reset();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="field-jn">
        <label htmlFor="rtx-kind">Kind</label>
        <select id="rtx-kind" name="kind" defaultValue="top_up" required>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} — {k.desc}
            </option>
          ))}
        </select>
      </div>
      <div className="field-jn">
        <label htmlFor="rtx-amount">Amount (USD)</label>
        <input
          id="rtx-amount"
          name="amount"
          type="number"
          step="1"
          min={-5000000}
          max={5000000}
          placeholder="100000"
          required
        />
      </div>
      <div className="field-jn">
        <label htmlFor="rtx-description">Description</label>
        <input
          id="rtx-description"
          name="description"
          type="text"
          placeholder="Wire received via JPM · ref 88421"
          maxLength={200}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {msg ? (
          <span
            className={[
              "font-mono text-[11px] uppercase tracking-[0.12em]",
              msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
            ].join(" ")}
          >
            {msg.text}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
            — Sign is automatic per kind; adjustment is literal.
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Posting…" : "Post entry"} <span className="arrow">→</span>
        </button>
      </div>
    </form>
  );
}
