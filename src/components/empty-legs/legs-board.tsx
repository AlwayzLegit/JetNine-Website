"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  EMPTY_LEGS,
  CATEGORY_LABELS,
  formatUSD,
  type EmptyLeg,
} from "@/lib/empty-legs";

type CategoryFilter = "all" | EmptyLeg["category"];
type TimeFilter = "any" | "48h" | "week";

function applyFilters(category: CategoryFilter, time: TimeFilter): EmptyLeg[] {
  return EMPTY_LEGS.filter((l) => {
    if (category !== "all" && l.category !== category) return false;
    if (time === "48h" && l.hoursOut > 48) return false;
    if (time === "week" && l.hoursOut > 168) return false;
    return true;
  });
}

function countByCategory(): Record<CategoryFilter, number> {
  const out: Record<CategoryFilter, number> = {
    all: EMPTY_LEGS.length,
    light: 0,
    midsize: 0,
    supermid: 0,
    heavy: 0,
    ultra: 0,
  };
  for (const l of EMPTY_LEGS) out[l.category]++;
  return out;
}

export function LegsBoard() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [time, setTime] = useState<TimeFilter>("any");

  const counts = useMemo(() => countByCategory(), []);
  const legs = useMemo(() => applyFilters(category, time), [category, time]);

  const catChips: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "All" },
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
            {legs.length} shown
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="container-jn py-16">
        {legs.length === 0 ? (
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
            {legs.map((l) => (
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
                      {l.id}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.04em] text-bone">
                      {CATEGORY_LABELS[l.category]} · {l.aircraft} · {l.year}
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
                      {l.fromCode}
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
                      {l.toCode}
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
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
                      onClick={() => alert(`${l.id} · details`)}
                    >
                      Details →
                    </button>
                    <Link
                      href={`/quote?leg=${l.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Book this leg <span className="arrow">→</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
