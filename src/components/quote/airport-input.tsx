"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchAirports, type Airport } from "@/lib/airports";
import { CompactField, COMPACT_INPUT_CLASS } from "./compact-field";

type Props = {
  label: string;
  value: { iata?: string; city?: string; name?: string };
  error?: boolean;
  onSelect: (a: Airport) => void;
};

// City first, code in parentheses — the plain-words way to show an airport.
function display(city: string | undefined, iata: string): string {
  return `${city ?? ""} (${iata})`.trim();
}

export function AirportInput({ label, value, error, onSelect }: Props) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState<string>(value.iata ? display(value.city, value.iata) : "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync query if value updates externally (e.g. trip-type swap, route chip).
  useEffect(() => {
    if (value.iata) setQuery(display(value.city, value.iata));
  }, [value.iata, value.city]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onChange(v: string) {
    setQuery(v);
    setResults(searchAirports(v));
    setOpen(true);
  }

  function pick(a: Airport) {
    setQuery(display(a.city, a.iata));
    setOpen(false);
    onSelect(a);
  }

  const showList = open && results.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <CompactField id={inputId} label={label} error={error}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setResults(searchAirports(query));
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="City, airport or code"
          autoComplete="off"
          className={COMPACT_INPUT_CLASS}
        />
      </CompactField>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="card absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        >
          {results.map((a) => (
            <li key={a.icao} role="option" aria-selected={a.iata === value.iata}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  // mousedown (not click) so the click-outside listener
                  // above doesn't close the list before the pick lands.
                  e.preventDefault();
                  pick(a);
                }}
                className="grid min-h-[52px] w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-line-faint px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[16px] text-bone">
                    {a.city} <span className="text-steel">({a.iata})</span>
                  </span>
                  <span className="block truncate text-[13px] text-steel">{a.name}</span>
                </span>
                <span className="text-[13px] text-steel">{a.icao}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
