"use client";

import { useState } from "react";

// Minimal leg shape needed to build an Avinode search line. ICAO codes live
// on quote_legs but aren't rendered elsewhere in the workbench (the leg cards
// show IATA); Avinode's search wants ICAO, so we use them here.
export type AvinodeSearchLeg = {
  fromIcao: string | null;
  toIcao: string | null;
  departDate: string | null; // Drizzle date() → "YYYY-MM-DD"
  departTime: string | null; // Drizzle time() → "HH:MM:SS"
};

// Readable min-category label. `+` denotes "this category or larger", which is
// how a dispatcher reads a floor into Avinode's category filter.
const CATEGORY_LABEL: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light",
  midsize: "Midsize",
  supermid: "Super-mid",
  heavy: "Heavy",
  ulr: "Ultra",
};

// "YYYY-MM-DD" → "DDMMYY" (Avinode's compact date). No shared date util exists
// in the repo, so this stays local to the component.
function toDDMMYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}${m}${y.slice(2)}`;
}

// "HH:MM:SS" → "HH:MM"
function toHHMM(t: string): string {
  return t.slice(0, 5);
}

function buildSearchString(
  paxCount: number,
  requestedCategory: string | null,
  legs: AvinodeSearchLeg[],
): string {
  const lines = legs.map((l) => {
    const route = `${l.fromIcao ?? "????"}-${l.toIcao ?? "????"}`;
    const date = l.departDate ? toDDMMYY(l.departDate) : "??????";
    const time = l.departTime ? toHHMM(l.departTime) : "----";
    return `${route}  ${date}  ${time}`;
  });
  const cat = requestedCategory
    ? `${CATEGORY_LABEL[requestedCategory] ?? requestedCategory}+`
    : "any";
  const summary = `PAX ${paxCount} · CAT ${cat}`;
  return [...lines, summary].join("\n");
}

export function AvinodeSearchCopy({
  paxCount,
  requestedCategory,
  legs,
}: {
  paxCount: number;
  requestedCategory: string | null;
  legs: AvinodeSearchLeg[];
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const disabled = legs.length === 0;

  async function onCopy() {
    const text = buildSearchString(paxCount, requestedCategory, legs);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
    // Transient — reset the label after a moment.
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={disabled}
      title="Copy a paste-ready Avinode search (route · date · time · pax · min category)"
      className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance disabled:opacity-40"
    >
      {state === "copied"
        ? "✓ Copied"
        : state === "error"
          ? "Copy failed"
          : "Copy search ⧉"}
    </button>
  );
}
