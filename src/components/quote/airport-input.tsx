"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchAirports, type Airport } from "@/lib/airports";

type Props = {
  label: string;
  value: { iata?: string; city?: string; name?: string };
  error?: boolean;
  onSelect: (a: Airport) => void;
};

export function AirportInput({ label, value, error, onSelect }: Props) {
  const inputId = useId();
  const [query, setQuery] = useState<string>(
    value.iata ? `${value.city ?? ""} (${value.iata})` : "",
  );
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync query if value updates externally (e.g. trip-type swap).
  useEffect(() => {
    if (value.iata) {
      setQuery(`${value.city ?? ""} (${value.iata})`);
    }
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
    setQuery(`${a.city} (${a.iata})`);
    setOpen(false);
    onSelect(a);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`field-jn ${error ? "error" : ""}`}>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setResults(searchAirports(query));
            setOpen(true);
          }}
          placeholder="City, airport or ICAO"
          autoComplete="off"
        />
        {value.iata ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[2px] border border-ink-4 bg-ink px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-clearance">
            {value.iata}
          </span>
        ) : null}
      </div>
      {open && results.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-[3px] border border-ink-3 bg-ink-2 shadow-lg">
          {results.map((a) => (
            <li key={a.icao}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(a);
                }}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-ink-3 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-ink"
              >
                <div>
                  <div className="font-serif text-[15px] text-bone">{a.city}</div>
                  <div className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {a.name}
                  </div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-clearance">
                  {a.iata} · {a.icao}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
