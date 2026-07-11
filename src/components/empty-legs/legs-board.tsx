"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_LABELS,
  formatUSD,
  type EmptyLegView,
} from "@/lib/empty-legs";
import { useQuoteStore } from "@/lib/quote-store";

type CategoryFilter = "all" | EmptyLegView["category"];
type TimeFilter = "any" | "48h" | "week";

function applyFilters(
  legs: EmptyLegView[],
  category: CategoryFilter,
  time: TimeFilter,
): EmptyLegView[] {
  return legs.filter((l) => {
    if (category !== "all" && l.category !== category) return false;
    if (time === "48h" && l.hoursOut > 48) return false;
    if (time === "week" && l.hoursOut > 168) return false;
    return true;
  });
}

function countByCategory(legs: EmptyLegView[]): Record<CategoryFilter, number> {
  const out: Record<CategoryFilter, number> = {
    all: legs.length,
    light: 0,
    midsize: 0,
    supermid: 0,
    heavy: 0,
    ultra: 0,
    turboprop: 0,
  };
  for (const l of legs) out[l.category]++;
  return out;
}

export function LegsBoard({ legs }: { legs: EmptyLegView[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [time, setTime] = useState<TimeFilter>("any");

  // Seed the quote wizard with this leg's route/date and reference the leg
  // code in the notes so dispatch prices against the board offer. (The old
  // `/quote?leg=CODE` link passed a param the wizard never read.)
  function bookLeg(l: EmptyLegView) {
    const store = useQuoteStore.getState();
    store.setTripType("oneway");
    const first = useQuoteStore.getState().legs[0];
    if (first) {
      store.updateLeg(first.id, {
        fromIata: l.fromIata,
        fromCity: l.fromCity,
        fromName: l.fromAirport,
        toIata: l.toIata,
        toCity: l.toCity,
        toName: l.toAirport,
        date: l.isoDate,
      });
    }
    store.setNotes(
      `Empty leg ${l.code} — ${l.fromIata} → ${l.toIata} ${l.date}, board price ${formatUSD(l.priceNow)}.`,
    );
    router.push("/quote/mission");
  }

  const counts = useMemo(() => countByCategory(legs), [legs]);
  const filtered = useMemo(
    () => applyFilters(legs, category, time),
    [legs, category, time],
  );

  const catChips: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "turboprop", label: CATEGORY_LABELS.turboprop },
    { id: "light", label: CATEGORY_LABELS.light },
    { id: "midsize", label: CATEGORY_LABELS.midsize },
    { id: "supermid", label: CATEGORY_LABELS.supermid },
    { id: "heavy", label: CATEGORY_LABELS.heavy },
    { id: "ultra", label: CATEGORY_LABELS.ultra },
  ];
  const timeChips: { id: TimeFilter; label: string }[] = [
    { id: "any", label: "Any time" },
    { id: "48h", label: "Next 48h" },
    { id: "week", label: "This week" },
  ];

  return (
    <section className="border-y border-ink-3 bg-ink">
      {/* Filter bar */}
      <div className="sticky top-20 z-30 border-b border-ink-3 bg-[rgba(7,8,10,0.92)] py-5 backdrop-blur-[14px]">
        <div className="container-jn flex flex-wrap items-center gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Category
            </span>
            {catChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={[
                  "rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  category === c.id
                    ? "border-clearance bg-clearance text-ink"
                    : "border-ink-3 text-bone-2 hover:border-bone-2 hover:text-bone",
                ].join(" ")}
              >
                {c.label} ({counts[c.id]})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Depart
            </span>
            {timeChips.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTime(t.id)}
                className={[
                  "rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  time === t.id
                    ? "border-clearance bg-clearance text-ink"
                    : "border-ink-3 text-bone-2 hover:border-bone-2 hover:text-bone",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-clearance">
            {filtered.length} shown
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="container-jn py-16">
        {filtered.length === 0 ? (
          <div className="mx-auto max-w-[48ch] rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
            <h3 className="font-serif text-[26px] font-normal leading-tight text-bone">
              No legs match those filters right now.
            </h3>
            <p className="mt-4 text-[15px] leading-[1.55] text-bone-2">
              Try widening the timeframe or category — or set a watchlist below and we&rsquo;ll text
              you when something shows up.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((l) => (
              <article
                key={l.id}
                className={[
                  "flex flex-col gap-5 rounded-[4px] border bg-ink-2 p-7 transition-all duration-200 ease-out-quint hover:-translate-y-0.5",
                  l.featured
                    ? "border-clearance"
                    : "border-ink-3 hover:border-[rgba(232,226,210,0.3)]",
                ].join(" ")}
              >
                <header className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                      {l.code}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.04em] text-bone">
                      {CATEGORY_LABELS[l.category]} · {l.aircraft}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-[2px] bg-clearance px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink">
                    {l.discountPct}% off
                  </span>
                </header>

                {/* Route diagram */}
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-y border-ink-3 py-6">
                  <div>
                    <div className="font-serif text-[28px] font-light leading-none tracking-tight text-bone">
                      {l.fromIata}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {l.fromCity}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-steel">
                      {l.fromAirport}
                    </div>
                  </div>
                  <div className="relative flex flex-col items-center px-2">
                    <svg viewBox="0 0 80 20" className="w-full" preserveAspectRatio="none">
                      <path d="M2 16 Q 40 0 78 16" fill="none" stroke="var(--clearance)" strokeWidth="0.7" strokeDasharray="1.5 2" />
                      <circle cx="2" cy="16" r="1.5" fill="var(--clearance)" />
                      <circle cx="78" cy="16" r="1.5" fill="var(--clearance)" />
                    </svg>
                    <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
                      {l.duration}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-[28px] font-light leading-none tracking-tight text-bone">
                      {l.toIata}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {l.toCity}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-steel">
                      {l.toAirport}
                    </div>
                  </div>
                </div>

                {/* Mid strip */}
                <div className="grid grid-cols-3 gap-3 text-[11px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono uppercase tracking-[0.12em] text-steel">— Depart</span>
                    <span className="font-mono tracking-[0.04em] text-bone">{l.date}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono uppercase tracking-[0.12em] text-steel">— Cabin</span>
                    <span className="font-mono tracking-[0.04em] text-bone">{l.seats} seats</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono uppercase tracking-[0.12em] text-steel">— Operator</span>
                    <span className="font-mono tracking-[0.04em] text-clearance">{l.operatorBadge}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-end justify-between gap-4 border-t border-ink-3 pt-6">
                  <div>
                    <div className="font-mono text-[11px] tracking-[0.04em] text-bone-2 line-through">
                      Was {formatUSD(l.priceWas)}
                    </div>
                    <div
                      className="font-serif text-[36px] font-light leading-none tracking-tight text-bone"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {formatUSD(l.priceNow)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => bookLeg(l)}
                    className="btn btn-primary btn-sm"
                  >
                    Book this leg <span className="arrow">→</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
