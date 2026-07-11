"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addSourcedOption,
  chooseSourcedOption,
  deleteSourcedOption,
  sendOptionsToClient,
} from "@/app/admin/quote/[id]/actions";
import { parseAvinodeOption } from "@/lib/avinode-parse";
import { formatUSD } from "@/lib/quote-pricing";

export type SourcedOptionRow = {
  id: string;
  optionNumber: number;
  aircraftType: string | null;
  tailNumber: string | null;
  operatorNameRaw: string | null;
  operatorMatched: boolean;
  safetyFloorPassed: boolean;
  category: string | null;
  operatorCostUsd: number | null;
  clientPriceUsd: number | null;
  markupType: "percent" | "flat";
  markupValue: string | null;
  isChosen: boolean;
  status: string;
};

const CATEGORIES = ["turboprop", "light", "midsize", "supermid", "heavy", "ulr"] as const;

type FormState = {
  aircraftType: string;
  tailNumber: string;
  operatorNameRaw: string;
  category: string;
  yearOfMake: string;
  paxCapacity: string;
  positioningTimeMin: string;
  positioningAirport: string;
  operatorCostUsd: string;
  markupType: "percent" | "flat";
  markupValue: string;
  avinodeRef: string;
  dispatcherNotes: string;
};

function emptyForm(defaultMarkupPct: number): FormState {
  return {
    aircraftType: "",
    tailNumber: "",
    operatorNameRaw: "",
    category: "",
    yearOfMake: "",
    paxCapacity: "",
    positioningTimeMin: "",
    positioningAirport: "",
    operatorCostUsd: "",
    markupType: "percent",
    markupValue: String(defaultMarkupPct),
    avinodeRef: "",
    dispatcherNotes: "",
  };
}

export function SourcedOptions({
  quoteId,
  initial,
  defaultMarkupPct,
}: {
  quoteId: string;
  initial: SourcedOptionRow[];
  defaultMarkupPct: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [paste, setPaste] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(defaultMarkupPct));

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Sendable = vetted + priced; mirrors the server-side filter.
  const sendableCount = initial.filter(
    (o) => o.safetyFloorPassed && o.clientPriceUsd != null && o.clientPriceUsd > 0,
  ).length;

  function onSend() {
    setMsg(null);
    setConfirmSend(false);
    startTransition(async () => {
      const result = await sendOptionsToClient(quoteId);
      if (result.ok) {
        setMsg({
          tone: "ok",
          text:
            result.delivery === "sent"
              ? `SENT ${result.count} OPTION${result.count === 1 ? "" : "S"} TO ${result.to.toUpperCase()}`
              : "QUEUED — EMAIL CHANNEL NOT CONFIGURED (LOGGED ONLY)",
        });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onParse() {
    const p = parseAvinodeOption(paste);
    setForm((f) => ({
      ...f,
      aircraftType: p.aircraftType ?? f.aircraftType,
      operatorNameRaw: p.operatorNameRaw ?? f.operatorNameRaw,
      yearOfMake: p.yearOfMake != null ? String(p.yearOfMake) : f.yearOfMake,
      paxCapacity: p.paxCapacity != null ? String(p.paxCapacity) : f.paxCapacity,
      positioningTimeMin: p.positioningTimeMin != null ? String(p.positioningTimeMin) : f.positioningTimeMin,
      positioningAirport: p.positioningAirport ?? f.positioningAirport,
      operatorCostUsd: p.operatorCostUsd != null ? String(p.operatorCostUsd) : f.operatorCostUsd,
    }));
    setAdding(true);
    setMsg({ tone: "ok", text: "PARSED — CONFIRM FIELDS, THEN SAVE" });
  }

  function toFormData(): FormData {
    const d = new FormData();
    Object.entries(form).forEach(([k, v]) => d.set(k, v));
    return d;
  }

  function onAdd() {
    setMsg(null);
    startTransition(async () => {
      const result = await addSourcedOption(quoteId, toFormData());
      if (result.ok) {
        setForm(emptyForm(defaultMarkupPct));
        setPaste("");
        setAdding(false);
        setMsg({ tone: "ok", text: "OPTION ADDED" });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onChoose(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await chooseSourcedOption(id);
      if (result.ok) {
        setMsg({ tone: "ok", text: "CHOSEN — DRIVES TRIP PRICING ON CONVERT" });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteSourcedOption(id);
      if (result.ok) router.refresh();
      else setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Existing options */}
      {initial.length === 0 ? (
        <p className="text-[12px] text-steel">
          — No sourced options yet. Paste an Avinode result below.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {initial.map((o) => {
            const badge = !o.operatorMatched
              ? { cls: "border-[var(--warn)] text-[var(--warn)]", label: "Screen" }
              : o.safetyFloorPassed
                ? { cls: "border-[var(--success)] text-[var(--success)]", label: "Vetted" }
                : { cls: "border-[var(--error)] text-[var(--error)]", label: "Blocked" };
            return (
              <li
                key={o.id}
                className={[
                  "rounded-[3px] border bg-ink p-3",
                  o.isChosen ? "border-clearance" : "border-ink-3",
                ].join(" ")}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-[14px] text-bone">
                    {o.aircraftType ?? "—"}
                    {o.tailNumber ? (
                      <span className="ml-2 font-mono text-[11px] text-clearance">{o.tailNumber}</span>
                    ) : null}
                  </span>
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                      badge.cls,
                    ].join(" ")}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-bone-2">
                  {o.operatorNameRaw ?? "— unknown operator"}
                  {!o.operatorMatched ? " · unmatched" : ""}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                    cost {o.operatorCostUsd != null ? formatUSD(o.operatorCostUsd) : "—"} ·{" "}
                    {o.markupType === "flat" ? `+$${o.markupValue ?? "0"}` : `+${o.markupValue ?? "0"}%`}
                  </span>
                  <span className="font-serif text-[16px] text-clearance">
                    {o.clientPriceUsd != null ? formatUSD(o.clientPriceUsd) : "—"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-end gap-3">
                  {o.status === "sent_to_client" ? (
                    <span className="mr-auto font-mono text-[9px] uppercase tracking-[0.12em] text-bone-2">
                      ✉ Sent to client
                    </span>
                  ) : null}
                  {o.isChosen ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                      ✓ Chosen
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChoose(o.id)}
                      disabled={pending}
                      className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance disabled:opacity-50"
                    >
                      Choose →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(o.id)}
                    disabled={pending}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Send to client — the action that closes the funnel. Sends every
          vetted + priced option as a branded quote sheet email. */}
      {initial.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-ink-3 bg-ink p-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-steel">
            — {sendableCount} sendable (vetted + priced)
          </span>
          {confirmSend ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmSend(false)}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={pending}
                className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Sending…" : "Confirm send"} <span className="arrow">→</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSend(true)}
              disabled={pending || sendableCount === 0}
              className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send {sendableCount || ""} to client <span className="arrow">→</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Paste box */}
      <div className="flex flex-col gap-2 border-t border-ink-3 pt-3">
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste an Avinode result here (price, aircraft, positioning, operator)…"
          rows={3}
          className="w-full rounded-[2px] border border-ink-3 bg-ink-2 px-3 py-2 font-mono text-[11px] text-bone placeholder:text-steel"
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onParse} disabled={!paste.trim() || pending} className="btn btn-ghost btn-sm disabled:opacity-50">
            Parse from Avinode
          </button>
          <button type="button" onClick={() => setAdding((v) => !v)} className="btn btn-ghost btn-sm">
            {adding ? "Hide fields" : "Add manually"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding ? (
        <form className="flex flex-col gap-3 rounded-[3px] border border-ink-3 bg-ink p-3" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-3">
            <TextF label="Aircraft type" v={form.aircraftType} on={(x) => set("aircraftType", x)} />
            <TextF label="Tail #" v={form.tailNumber} on={(x) => set("tailNumber", x)} />
            <TextF label="Operator (seller)" v={form.operatorNameRaw} on={(x) => set("operatorNameRaw", x)} />
            <div className="field-jn">
              <label htmlFor="so-cat">Category</label>
              <select id="so-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c === "ulr" ? "ultra" : c}</option>
                ))}
              </select>
            </div>
            <TextF label="Year" v={form.yearOfMake} on={(x) => set("yearOfMake", x)} type="number" />
            <TextF label="Pax" v={form.paxCapacity} on={(x) => set("paxCapacity", x)} type="number" />
            <TextF label="Positioning (min)" v={form.positioningTimeMin} on={(x) => set("positioningTimeMin", x)} type="number" />
            <TextF label="Positioning ICAO" v={form.positioningAirport} on={(x) => set("positioningAirport", x)} />
            <TextF label="Operator cost (USD)" v={form.operatorCostUsd} on={(x) => set("operatorCostUsd", x)} type="number" />
            <div className="grid grid-cols-[1fr_1.2fr] gap-2">
              <div className="field-jn">
                <label htmlFor="so-mt">Markup</label>
                <select id="so-mt" value={form.markupType} onChange={(e) => set("markupType", e.target.value)}>
                  <option value="percent">%</option>
                  <option value="flat">$ flat</option>
                </select>
              </div>
              <TextF label="Value" v={form.markupValue} on={(x) => set("markupValue", x)} type="number" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Client price = cost + markup, computed on save.
            </span>
            <button type="button" onClick={onAdd} disabled={pending} className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60">
              {pending ? "Saving…" : "Save option"} <span className="arrow">→</span>
            </button>
          </div>
        </form>
      ) : null}

      {msg ? (
        <span
          className={[
            "font-mono text-[10px] uppercase tracking-[0.12em]",
            msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
          ].join(" ")}
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}

function TextF({
  label,
  v,
  on,
  type = "text",
}: {
  label: string;
  v: string;
  on: (x: string) => void;
  type?: string;
}) {
  const id = `so-${label.replace(/[^a-z]/gi, "").toLowerCase()}`;
  return (
    <div className="field-jn">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
