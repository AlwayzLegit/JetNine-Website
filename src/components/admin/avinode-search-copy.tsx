"use client";

import { useState } from "react";
import { AVINODE_URL } from "@/components/admin/desk-sidebar";

// Minimal leg shape needed to build an Avinode search line. ICAO codes live
// on quote_legs but aren't rendered elsewhere on the request page (the trip
// card shows IATA); Avinode's search wants ICAO, so we use them here.
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

/**
 * "Search in Avinode ↗": opens Avinode in a new tab and puts a paste-ready
 * search (route · date · time · passengers · category floor) on the
 * clipboard, since Avinode has no API to hand the search over directly.
 */
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

  async function onClick() {
    const text = buildSearchString(paxCount, requestedCategory, legs);
    // Open first — a popup opened after an await can be blocked.
    window.open(AVINODE_URL, "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
    // Transient — reset the label after a moment.
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Opens Avinode and copies a paste-ready search: route, date, time, passengers and the smallest category that fits."
      className="inline-flex h-11 items-center whitespace-nowrap border border-line bg-surface px-3 text-[13px] text-bone transition-colors hover:border-bone disabled:cursor-not-allowed disabled:opacity-50 md:h-8"
    >
      {state === "copied" ? (
        "Search copied ✓"
      ) : state === "error" ? (
        "Couldn't copy the search"
      ) : (
        <>
          Search in Avinode <span aria-hidden="true">↗</span>
        </>
      )}
    </button>
  );
}
