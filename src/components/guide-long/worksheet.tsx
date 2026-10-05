"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LightWindow, WindowButton } from "@/components/light/window";
import { MiniChecklist } from "./checklist";
import { TINT_BG, TINT_BORDER } from "./ui";

export const QUOTE_ROWS = [
  "Aircraft type and year",
  "Operating carrier named?",
  "Total price (all-in?)",
  "What is included",
  "Quote valid until",
  "Cancellation terms",
  "Positioning / overnight",
  "Notes",
];

type Saved = Record<string, string>;

function load(key: string): Saved {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
}

function WorksheetBody({ rows, cols, storageKey }: { rows: string[]; cols: string[]; storageKey: string }) {
  const [saved, setSaved] = useState<Saved>({});
  const [done, setDone] = useState(false);
  useEffect(() => setSaved(load(storageKey)), [storageKey]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d: Saved = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      d[k] = String(v);
    });
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(d));
    } catch {
      /* storage blocked */
    }
    setSaved(d);
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="mt-[14px] overflow-x-auto" tabIndex={0} role="region" aria-label="Worksheet — scrolls sideways">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2">
              <th className="border-b border-line px-[10px] py-2 text-left" />
              {cols.map((c) => (
                <th key={c} scope="col" className="border-b border-line px-[10px] py-2 text-left font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r}>
                <th scope="row" className="whitespace-nowrap border-b border-line px-[10px] py-2 text-left font-bold">
                  {r}
                </th>
                {cols.map((c, j) => (
                  <td key={c} className="border-b border-line p-[6px]">
                    <input
                      name={`r${i}c${j}`}
                      aria-label={`${r} — ${c}`}
                      defaultValue={saved[`r${i}c${j}`] ?? ""}
                      key={`${saved[`r${i}c${j}`] ?? ""}`}
                      className="h-[34px] w-full min-w-0 rounded-[2px] border border-line bg-white px-2 text-[14px] text-bone outline-none focus:border-bone"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-[10px]">
        <button type="submit" className="btn btn-primary btn-sm">
          Save on this device
        </button>
        <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-sm">
          Print
        </button>
        {done ? <span className="text-[13px] text-success">Saved</span> : null}
      </div>
      <p className="mt-[14px] text-[12px] leading-[1.5] text-steel">
        If a row is blank for one proposal, ask before you compare prices. The cheapest headline figure is rarely the
        complete price.
      </p>
    </form>
  );
}

const worksheetTitle = (
  <>
    <span className="mb-2 block font-sans text-[12px] font-bold uppercase tracking-[.2em] text-gold">Comparison worksheet</span>
    Compare the same trip.
  </>
);

/** A button that opens the quote comparison worksheet. */
export function WorksheetWindow({
  label,
  className,
  cols = ["Quote A", "Quote B", "Quote C"],
  rows = QUOTE_ROWS,
  storageKey,
}: {
  label: ReactNode;
  className?: string;
  cols?: string[];
  rows?: string[];
  storageKey: string;
}) {
  return (
    <WindowButton label={label} className={className} title={worksheetTitle} sub="Fill the same rows for each proposal, then compare like with like.">
      <WorksheetBody rows={rows} cols={cols} storageKey={`jn-guide:${storageKey}`} />
    </WindowButton>
  );
}

/**
 * Sand aside from "Choosing a company" / "Compare quotes": name up to
 * three providers (or quotes), tick what is confirmed, then open the
 * worksheet with those names as its columns.
 */
export function WorksheetAside({
  title,
  body,
  placeholders,
  checks,
  button,
  buttonClass,
  note,
  storageKey,
}: {
  title: string;
  body: string;
  placeholders: string[];
  checks: string[];
  button: string;
  buttonClass: string;
  note: string;
  storageKey: string;
}) {
  const [names, setNames] = useState<string[]>(placeholders.map(() => ""));
  const [open, setOpen] = useState(false);
  const cols = placeholders.map((p, i) => names[i]?.trim() || p);
  return (
    <>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
      className={`border p-[18px] ${TINT_BG} ${TINT_BORDER}`}
    >
      <h2 className="m-0 font-serif text-[26px] font-normal leading-[1.1]">{title}</h2>
      <p className="mb-3 mt-[6px] text-[13px] text-steel">{body}</p>
      <div className="flex flex-col gap-2">
        {placeholders.map((p, i) => (
          <input
            key={p}
            type="text"
            aria-label={p}
            placeholder={p}
            value={names[i]}
            onChange={(e) => setNames((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
            className="h-[34px] rounded-[2px] border border-line bg-white px-[10px] text-[13px] text-bone outline-none focus:border-bone"
          />
        ))}
      </div>
      <MiniChecklist items={checks} size={18} className="mt-[14px]" />
      <button type="submit" className={`mt-4 w-full ${buttonClass}`}>
        {button}
      </button>
      <p className="mt-2 text-[12px] text-steel">{note}</p>
    </form>
      <LightWindow open={open} onClose={() => setOpen(false)} title={worksheetTitle} sub="Fill the same rows for each proposal, then compare like with like.">
        <WorksheetBody rows={QUOTE_ROWS} cols={cols} storageKey={`jn-guide:${storageKey}`} />
      </LightWindow>
    </>
  );
}
