"use client";

import { useState, useTransition } from "react";
import { updateInvoice } from "@/app/admin/trip/[id]/actions";

type Props = {
  invoiceId: string;
  initial: {
    subtotalUsd: number | null;
    fetUsd: number | null;
    segmentFeeUsd: number | null;
    totalUsd: number | null;
    dueOn: string | null;
    notes: string | null;
  };
};

// FET is 7.5% of subtotal (mirrors convertQuoteToTrip). The Recompute
// button derives FET + Total from the typed subtotal + segment fee so the
// dispatcher doesn't hand-add — but every field stays manually editable
// for the operator-quoted cases where the numbers don't follow the formula.
const FET_RATE = 0.075;

function toField(n: number | null): string {
  return n === null || Number.isNaN(n) ? "" : String(n);
}

export function InvoiceFinalizeForm({ invoiceId, initial }: Props) {
  const [subtotal, setSubtotal] = useState(toField(initial.subtotalUsd));
  const [fet, setFet] = useState(toField(initial.fetUsd));
  const [segment, setSegment] = useState(toField(initial.segmentFeeUsd));
  const [total, setTotal] = useState(toField(initial.totalUsd));
  const [dueOn, setDueOn] = useState(initial.dueOn ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function recompute() {
    const sub = Number(subtotal);
    const seg = Number(segment) || 0;
    if (!subtotal.trim() || !Number.isFinite(sub)) {
      setMsg({ tone: "error", text: "ENTER A SUBTOTAL FIRST" });
      return;
    }
    const computedFet = Math.round(sub * FET_RATE);
    setFet(String(computedFet));
    setTotal(String(Math.round(sub) + computedFet + Math.round(seg)));
    setMsg(null);
  }

  function submit(intent: "save" | "finalize") {
    if (
      intent === "finalize" &&
      !window.confirm(
        "Finalize this invoice to DUE? The member will see a Pay button and the figures lock.",
      )
    ) {
      return;
    }
    const data = new FormData();
    data.set("intent", intent);
    data.set("subtotalUsd", subtotal);
    data.set("fetUsd", fet);
    data.set("segmentFeeUsd", segment);
    data.set("totalUsd", total);
    data.set("dueOn", dueOn);
    data.set("notes", notes);
    setMsg(null);
    startTransition(async () => {
      const result = await updateInvoice(invoiceId, data);
      if (result.ok) {
        setMsg({
          tone: "ok",
          text: result.status === "due" ? "FINALIZED — NOW DUE" : "DRAFT SAVED",
        });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  return (
    <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <div className="grid grid-cols-2 gap-3">
        <div className="field-jn">
          <label htmlFor="inv-subtotal">Subtotal (USD)</label>
          <input
            id="inv-subtotal"
            type="number"
            step="1"
            min={0}
            max={99999999}
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            placeholder="e.g. 38500"
          />
        </div>
        <div className="field-jn">
          <label htmlFor="inv-segment">Segment fee (USD)</label>
          <input
            id="inv-segment"
            type="number"
            step="1"
            min={0}
            max={99999999}
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="inv-fet">FET — 7.5% (USD)</label>
          <input
            id="inv-fet"
            type="number"
            step="1"
            min={0}
            max={99999999}
            value={fet}
            onChange={(e) => setFet(e.target.value)}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="inv-total">Total (USD)</label>
          <input
            id="inv-total"
            type="number"
            step="1"
            min={0}
            max={99999999}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="required to finalize"
          />
        </div>
        <div className="field-jn">
          <label htmlFor="inv-due">Due date</label>
          <input
            id="inv-due"
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={recompute}
            className="btn btn-ghost btn-sm w-full"
          >
            Recompute FET + Total
          </button>
        </div>
      </div>

      <div className="field-jn">
        <label htmlFor="inv-notes">Notes</label>
        <input
          id="inv-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Operator quote ref, wire instructions, etc."
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
            — Save keeps it draft; Finalize opens the member Pay button.
          </span>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit("save")}
            disabled={pending}
            className="btn btn-ghost btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => submit("finalize")}
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Working…" : "Finalize → Due"} <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </form>
  );
}
