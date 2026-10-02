"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  addSourcedOption,
  chooseSourcedOption,
  deleteSourcedOption,
  sendOptionsToClient,
  updateSourcedOption,
} from "@/app/admin/requests/[id]/actions";
import { parseAvinodeOption } from "@/lib/avinode-parse";
import { formatUSD } from "@/lib/quote-pricing";
import { AvinodeSearchCopy, type AvinodeSearchLeg } from "@/components/admin/avinode-search-copy";
import { categoryShort } from "@/components/admin/requests/words";

/**
 * One sourced option as the page loads it. Every column the server rebuilds
 * on update is here, so "Change price" can resend the row with only the
 * price fields changed (updateSourcedOption rewrites the whole row from
 * the form).
 */
export type SourcedOptionRow = {
  id: string;
  optionNumber: number;
  avinodeRef: string | null;
  aircraftType: string | null;
  tailNumber: string | null;
  isFloatingFleet: boolean;
  yearOfMake: number | null;
  category: string | null;
  paxCapacity: number | null;
  refurbInteriorYear: number | null;
  refurbExteriorYear: number | null;
  operatorNameRaw: string | null;
  operatorMatched: boolean;
  safetyFloorPassed: boolean;
  positioningTimeMin: number | null;
  positioningAirport: string | null;
  totalFlightTimeMin: number | null;
  operatorCostUsd: number | null;
  markupType: "percent" | "flat";
  markupValue: string | null;
  clientPriceUsd: number | null;
  isChosen: boolean;
  status: string;
  dispatcherNotes: string | null;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "turboprop", label: "Turboprop" },
  { value: "light", label: "Light" },
  { value: "midsize", label: "Midsize" },
  { value: "supermid", label: "Super-mid" },
  { value: "heavy", label: "Heavy" },
  { value: "ulr", label: "Ultra long range" },
];

// Statuses in which "Send options" advances the request (mirrors the action).
const SENDABLE_STATUSES = ["submitted", "triaged", "sourcing"];

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

type PriceForm = { operatorCostUsd: string; markupType: "percent" | "flat"; markupValue: string };

/** Full row → FormData for updateSourcedOption, with the price fields overridden. */
function rowToFormData(o: SourcedOptionRow, price: PriceForm): FormData {
  const d = new FormData();
  const put = (k: string, v: string | number | boolean | null | undefined) =>
    d.set(k, v == null || v === false ? "" : v === true ? "true" : String(v));
  put("avinodeRef", o.avinodeRef);
  put("aircraftType", o.aircraftType);
  put("tailNumber", o.tailNumber);
  put("isFloatingFleet", o.isFloatingFleet);
  put("yearOfMake", o.yearOfMake);
  put("category", o.category);
  put("paxCapacity", o.paxCapacity);
  put("refurbInteriorYear", o.refurbInteriorYear);
  put("refurbExteriorYear", o.refurbExteriorYear);
  put("operatorNameRaw", o.operatorNameRaw);
  put("positioningTimeMin", o.positioningTimeMin);
  put("positioningAirport", o.positioningAirport);
  put("totalFlightTimeMin", o.totalFlightTimeMin);
  put("dispatcherNotes", o.dispatcherNotes);
  put("operatorCostUsd", price.operatorCostUsd);
  put("markupType", price.markupType);
  put("markupValue", price.markupValue);
  return d;
}

function markupWords(o: SourcedOptionRow): string | null {
  if (o.markupValue == null) return null;
  const v = Number(o.markupValue);
  if (!Number.isFinite(v)) return null;
  return o.markupType === "flat" ? `+${formatUSD(v)} markup` : `${v}% markup`;
}

function isSendable(o: SourcedOptionRow): boolean {
  return o.safetyFloorPassed && o.clientPriceUsd != null && o.clientPriceUsd > 0;
}

export function SourcedOptions({
  quoteId,
  initial,
  defaultMarkupPct,
  clientFirstName,
  quoteStatus,
  avinode,
  children,
}: {
  quoteId: string;
  initial: SourcedOptionRow[];
  defaultMarkupPct: number;
  clientFirstName: string | null;
  quoteStatus: string;
  avinode: { paxCount: number; requestedCategory: string | null; legs: AvinodeSearchLeg[] };
  /** Collapsed "Our fleet matches and holds" block, rendered under the options. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(defaultMarkupPct));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [price, setPrice] = useState<PriceForm>({
    operatorCostUsd: "",
    markupType: "percent",
    markupValue: String(defaultMarkupPct),
  });

  const first = clientFirstName?.trim() || null;
  const them = first ?? "the client";
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const sendableCount = initial.filter(isSendable).length;
  const unsendable = initial.length - sendableCount;
  const statusAllowsSend = SENDABLE_STATUSES.includes(quoteStatus);
  const canSend = statusAllowsSend && initial.length >= 2 && sendableCount >= 1 && !pending;

  const sendHint = !statusAllowsSend
    ? quoteStatus === "options_sent" || quoteStatus === "held"
      ? `Already sent. ${first ?? "The client"} picks from their page.`
      : quoteStatus === "accepted"
        ? `${first ?? "The client"} picked one — confirm the booking under Desk tools.`
        : quoteStatus === "converted"
          ? "Booked. This request is now a Trip."
          : "This request is closed."
    : initial.length < 2
      ? "Needs at least 2 options. They'll get an email with a link to pick."
      : sendableCount === 0
        ? "None of these can go out yet — each needs a vetted operator and a price."
        : `They'll get an email with a link to compare and pick.${
            unsendable > 0
              ? ` ${unsendable} of the ${initial.length} won't be included until its operator is screened and priced.`
              : ""
          }`;

  function openPaste() {
    setPasteOpen(true);
    setMsg(null);
  }

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
              ? `Sent ${result.count} option${result.count === 1 ? "" : "s"} to ${result.to}.`
              : "Recorded, but the email channel isn't configured — nothing was delivered.",
        });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: result.error });
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
    setFieldsOpen(true);
    setMsg({ tone: "ok", text: "Read it — check the fields, then save." });
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
        setFieldsOpen(false);
        setPasteOpen(false);
        setMsg({ tone: "ok", text: "Option added." });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  function startEdit(o: SourcedOptionRow) {
    setMsg(null);
    setEditingId(o.id);
    setPrice({
      operatorCostUsd: o.operatorCostUsd != null ? String(o.operatorCostUsd) : "",
      markupType: o.markupType,
      markupValue: o.markupValue ?? String(defaultMarkupPct),
    });
  }

  function onSavePrice(o: SourcedOptionRow) {
    setMsg(null);
    startTransition(async () => {
      const result = await updateSourcedOption(o.id, rowToFormData(o, price));
      if (result.ok) {
        setEditingId(null);
        setMsg({ tone: "ok", text: "Price updated." });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  function onChoose(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await chooseSourcedOption(id);
      if (result.ok) {
        setMsg({ tone: "ok", text: "Marked as the chosen option — it sets the trip price when you confirm." });
        router.refresh();
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteSourcedOption(id);
      if (result.ok) router.refresh();
      else setMsg({ tone: "error", text: result.error });
    });
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-jn text-[13px]">Options to send</h2>
        <div className="flex flex-wrap gap-2">
          <AvinodeSearchCopy
            paxCount={avinode.paxCount}
            requestedCategory={avinode.requestedCategory}
            legs={avinode.legs}
          />
          <button
            type="button"
            onClick={() => (pasteOpen ? setPasteOpen(false) : openPaste())}
            aria-expanded={pasteOpen}
            aria-controls={`paste-${quoteId}`}
            className="btn btn-secondary h-9 px-3 text-[14px]"
          >
            {pasteOpen ? "Close" : "Paste Avinode quote"}
          </button>
        </div>
      </div>

      {/* Option rows */}
      <div className="mt-3.5 flex flex-col gap-2.5">
        {initial.map((o) => {
          const meta = [categoryShort(o.category), o.paxCapacity ? `${o.paxCapacity} seats` : null, o.yearOfMake]
            .filter(Boolean)
            .join(" · ");
          const editing = editingId === o.id;
          const vetting = !o.operatorMatched
            ? { text: "Operator not matched yet — screen before sending", cls: "text-gold" }
            : !o.safetyFloorPassed
              ? { text: "Operator fails the safety floor — can't be sent", cls: "text-danger" }
              : { text: "vetted operator", cls: "text-steel" };
          return (
            <article
              key={o.id}
              className={`rounded-control border bg-ink px-4 py-3.5 ${o.isChosen ? "border-clearance" : "border-line"}`}
            >
              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="text-[17px] font-medium text-bone">
                    {o.aircraftType ?? "Aircraft"}
                    {meta ? <span className="font-normal text-steel"> · {meta}</span> : null}
                    {o.tailNumber ? <span className="font-normal text-steel"> · {o.tailNumber}</span> : null}
                  </div>
                  <div className="mt-1 text-bone-2">
                    {o.operatorCostUsd != null ? (
                      <>
                        Operator price {formatUSD(o.operatorCostUsd)} → client price{" "}
                        <b className="font-medium text-bone">
                          {o.clientPriceUsd != null ? formatUSD(o.clientPriceUsd) : "—"}
                        </b>
                        {markupWords(o) ? <span className="text-steel"> ({markupWords(o)})</span> : null}
                      </>
                    ) : (
                      <span className="text-steel">No price yet</span>
                    )}
                  </div>
                  <div className="mt-1 text-[14px] text-steel">
                    {o.operatorNameRaw ?? "Operator not named"}
                    {" · "}
                    <span className={vetting.cls}>{vetting.text}</span>
                    {o.status === "sent_to_client" ? " · sent" : null}
                    {o.isChosen ? <span className="text-success"> · chosen ✓</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap text-[14px]">
                  <button
                    type="button"
                    onClick={() => (editing ? setEditingId(null) : startEdit(o))}
                    disabled={pending}
                    className="text-link disabled:opacity-50"
                  >
                    {editing ? "Cancel" : "Change price"}
                  </button>
                  <span className="text-steel-dim">·</span>
                  <button
                    type="button"
                    onClick={() => onDelete(o.id)}
                    disabled={pending}
                    className="text-link disabled:opacity-50"
                  >
                    Remove
                  </button>
                  {!o.isChosen && isSendable(o) ? (
                    <>
                      <span className="text-steel-dim">·</span>
                      <button
                        type="button"
                        onClick={() => onChoose(o.id)}
                        disabled={pending}
                        className="text-link disabled:opacity-50"
                      >
                        Mark chosen
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {editing ? (
                <form
                  className="mt-3.5 grid grid-cols-1 gap-2.5 border-t border-line pt-3.5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSavePrice(o);
                  }}
                >
                  <div className="field-jn">
                    <label htmlFor={`price-cost-${o.id}`}>Operator price (USD)</label>
                    <input
                      id={`price-cost-${o.id}`}
                      type="number"
                      min={0}
                      value={price.operatorCostUsd}
                      onChange={(e) => setPrice((p) => ({ ...p, operatorCostUsd: e.target.value }))}
                    />
                  </div>
                  <div className="field-jn">
                    <label htmlFor={`price-type-${o.id}`}>Markup</label>
                    <select
                      id={`price-type-${o.id}`}
                      value={price.markupType}
                      onChange={(e) =>
                        setPrice((p) => ({ ...p, markupType: e.target.value === "flat" ? "flat" : "percent" }))
                      }
                    >
                      <option value="percent">Percent</option>
                      <option value="flat">Flat amount</option>
                    </select>
                  </div>
                  <div className="field-jn">
                    <label htmlFor={`price-value-${o.id}`}>
                      {price.markupType === "flat" ? "Markup (USD)" : "Markup (%)"}
                    </label>
                    <input
                      id={`price-value-${o.id}`}
                      type="number"
                      min={0}
                      value={price.markupValue}
                      onChange={(e) => setPrice((p) => ({ ...p, markupValue: e.target.value }))}
                    />
                  </div>
                  <button type="submit" disabled={pending} className="btn btn-primary btn-sm disabled:cursor-wait">
                    {pending ? "Saving…" : "Save price"}
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}

        {initial.length < 2 ? (
          <button
            type="button"
            onClick={openPaste}
            className="flex items-center justify-center rounded-control border border-dashed border-line-2 px-4 py-[18px] text-center text-[15px] text-steel transition-colors hover:border-steel hover:text-bone-2"
          >
            {initial.length === 0
              ? "+ Add the first option — clients decide faster with 2 or 3 to compare"
              : "+ Add another option — clients decide faster with 2 or 3 to compare"}
          </button>
        ) : null}
      </div>

      {/* Paste-in + fields, collapsed by default */}
      {pasteOpen ? (
        <div id={`paste-${quoteId}`} className="mt-3.5 flex flex-col gap-3 rounded-control border border-line bg-ink p-4">
          <div className="field-jn">
            <label htmlFor={`paste-text-${quoteId}`}>Avinode quote</label>
            <textarea
              id={`paste-text-${quoteId}`}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Paste the quote here — price, aircraft, positioning, operator."
              rows={3}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onParse}
              disabled={!paste.trim() || pending}
              className="btn btn-secondary btn-sm disabled:cursor-not-allowed"
            >
              Read the paste
            </button>
            <button type="button" onClick={() => setFieldsOpen((v) => !v)} className="text-link text-[14px]">
              {fieldsOpen ? "Hide the fields" : "Enter by hand"}
            </button>
          </div>

          {fieldsOpen ? (
            <form
              className="flex flex-col gap-3 border-t border-line pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                onAdd();
              }}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <TextF label="Aircraft type" v={form.aircraftType} on={(x) => set("aircraftType", x)} />
                <TextF label="Tail number" v={form.tailNumber} on={(x) => set("tailNumber", x)} />
                <TextF label="Operator (seller)" v={form.operatorNameRaw} on={(x) => set("operatorNameRaw", x)} />
                <div className="field-jn">
                  <label htmlFor="so-cat">Category</label>
                  <select id="so-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
                    <option value="">Not sure</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <TextF label="Year" v={form.yearOfMake} on={(x) => set("yearOfMake", x)} type="number" />
                <TextF label="Seats" v={form.paxCapacity} on={(x) => set("paxCapacity", x)} type="number" />
                <TextF
                  label="Positioning (minutes)"
                  v={form.positioningTimeMin}
                  on={(x) => set("positioningTimeMin", x)}
                  type="number"
                />
                <TextF
                  label="Positioning from (airport code)"
                  v={form.positioningAirport}
                  on={(x) => set("positioningAirport", x)}
                />
                <TextF
                  label="Operator price (USD)"
                  v={form.operatorCostUsd}
                  on={(x) => set("operatorCostUsd", x)}
                  type="number"
                />
                <div className="grid grid-cols-[1fr_1.2fr] gap-2.5">
                  <div className="field-jn">
                    <label htmlFor="so-mt">Markup</label>
                    <select
                      id="so-mt"
                      value={form.markupType}
                      onChange={(e) => set("markupType", e.target.value)}
                    >
                      <option value="percent">Percent</option>
                      <option value="flat">Flat amount</option>
                    </select>
                  </div>
                  <TextF
                    label={form.markupType === "flat" ? "Markup (USD)" : "Markup (%)"}
                    v={form.markupValue}
                    on={(x) => set("markupValue", x)}
                    type="number"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] text-steel">
                  Client price = operator price + markup, worked out when you save.
                </span>
                <button type="submit" disabled={pending} className="btn btn-primary btn-sm disabled:cursor-wait">
                  {pending ? "Saving…" : "Save option"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {/* Send to the client — the action that closes the funnel. */}
      <div className="mt-5 flex flex-wrap items-center gap-3.5">
        {confirmSend ? (
          <>
            <button
              type="button"
              onClick={onSend}
              disabled={pending}
              className="btn btn-primary btn-lg disabled:cursor-wait"
            >
              {pending ? "Sending…" : `Send now to ${them}`} <span className="arrow">→</span>
            </button>
            <button type="button" onClick={() => setConfirmSend(false)} className="text-link text-[14px]">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmSend(true)}
            disabled={!canSend}
            className="btn btn-primary btn-lg disabled:cursor-not-allowed"
          >
            Send options to {them} <span className="arrow">→</span>
          </button>
        )}
        <p className="m-0 max-w-[36ch] text-[14px] leading-[1.45] text-steel">{sendHint}</p>
      </div>

      {msg ? (
        <p className={`mt-3 text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>{msg.text}</p>
      ) : null}

      {children ? <div className="mt-5 border-t border-line pt-4">{children}</div> : null}
    </section>
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
