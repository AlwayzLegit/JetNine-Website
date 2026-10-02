"use client";

import { useState, useTransition } from "react";
import { updateInvoice } from "@/app/admin/trips/[id]/actions";

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

// FET is 7.5% of subtotal (mirrors convertQuoteToTrip). "Work out the
// total" derives FET + Total from the typed subtotal + segment fee so the
// dispatcher doesn't hand-add — but every field stays manually editable
// for the operator-quoted cases where the numbers don't follow the formula.
const FET_RATE = 0.075;

function toField(n: number | null): string {
  return n === null || Number.isNaN(n) ? "" : String(n);
}

/**
 * Draft-invoice editor on the trip sheet ("Money" card). Save keeps the
 * invoice a draft; Send finalizes it to `due`, which emails the client a
 * Pay button and locks the figures.
 */
export function InvoiceFinalizeForm({ invoiceId, initial }: Props) {
  const [subtotal, setSubtotal] = useState(toField(initial.subtotalUsd));
  const [fet, setFet] = useState(toField(initial.fetUsd));
  const [segment, setSegment] = useState(toField(initial.segmentFeeUsd));
  const [total, setTotal] = useState(toField(initial.totalUsd));
  const [dueOn, setDueOn] = useState(initial.dueOn ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Inline two-step confirm for finalize. A native window.confirm() blocks
  // the renderer thread — which froze headless/automation browsers and made
  // the action never fire — so we gate finalize behind a visible confirm row.
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  function recompute() {
    const sub = Number(subtotal);
    const seg = Number(segment) || 0;
    if (!subtotal.trim() || !Number.isFinite(sub)) {
      setMsg({ tone: "error", text: "Enter the charter amount first." });
      return;
    }
    const computedFet = Math.round(sub * FET_RATE);
    setFet(String(computedFet));
    setTotal(String(Math.round(sub) + computedFet + Math.round(seg)));
    setMsg(null);
  }

  function persist(intent: "save" | "finalize") {
    const data = new FormData();
    data.set("intent", intent);
    data.set("subtotalUsd", subtotal);
    data.set("fetUsd", fet);
    data.set("segmentFeeUsd", segment);
    data.set("totalUsd", total);
    data.set("dueOn", dueOn);
    data.set("notes", notes);
    setMsg(null);
    setConfirmFinalize(false);
    startTransition(async () => {
      const result = await updateInvoice(invoiceId, data);
      if (result.ok) {
        setMsg({
          tone: "ok",
          text: result.status === "due" ? "Invoice sent. The client can pay now." : "Draft saved.",
        });
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="field-jn">
          <label htmlFor="inv-subtotal">Charter (USD)</label>
          <input
            id="inv-subtotal"
            type="number"
            step="1"
            min={0}
            max={99999999}
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            placeholder="38500"
          />
        </div>
        <div className="field-jn">
          <label htmlFor="inv-segment">Segment fees (USD)</label>
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
          <label htmlFor="inv-fet">Federal excise tax · 7.5% (USD)</label>
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
            placeholder="Needed before sending"
          />
        </div>
        <div className="field-jn">
          <label htmlFor="inv-due">Due date</label>
          <input id="inv-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={recompute} className="btn btn-secondary btn-sm w-full">
            Work out tax and total
          </button>
        </div>
      </div>

      <div className="field-jn">
        <label htmlFor="inv-notes">Notes on the invoice</label>
        <input
          id="inv-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Operator quote reference, wire instructions…"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {msg ? (
          <span
            role={msg.tone === "error" ? "alert" : "status"}
            className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}
          >
            {msg.text}
          </span>
        ) : (
          <span className="text-[13px] text-steel">
            {confirmFinalize
              ? "Sending emails the client a Pay button and locks these figures."
              : "Save keeps it as a draft. Send emails the client a Pay button."}
          </span>
        )}
        {confirmFinalize ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmFinalize(false)}
              disabled={pending}
              className="btn btn-secondary btn-sm"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => persist("finalize")}
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Sending…" : "Yes, send it"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => persist("save")}
              disabled={pending}
              className="btn btn-secondary btn-sm"
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmFinalize(true)}
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              Send invoice
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
