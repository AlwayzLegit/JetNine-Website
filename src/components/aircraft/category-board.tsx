"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LightWindow } from "@/components/light/window";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { LineIcon } from "./line-icon";

export type BoardCategory = {
  slug: AircraftCategorySlug;
  href: string;
  name: string;
  body: string;
  examples: string;
  image: string;
  pax: number;
  range: string;
  fit: string;
  cabin: string;
  bags: string;
  sub: string;
  samples: { name: string; href?: string; image?: string }[];
};

const MAX = 3;

/**
 * "Six categories. A clear place to start." — category cards with a
 * Compare tick (up to three), a quick-view drawer per card and the
 * shortlist comparison window (JNP catQuick / catCompare).
 */
export function CategoryBoard({ cats }: { cats: BoardCategory[] }) {
  const [sel, setSel] = useState<AircraftCategorySlug[]>([]);
  const [quick, setQuick] = useState<AircraftCategorySlug | null>(null);
  const [compare, setCompare] = useState(false);

  const toggle = (k: AircraftCategorySlug) =>
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length < MAX ? [...s, k] : s));

  const q = cats.find((c) => c.slug === quick);
  const shortlist = (sel.length ? sel : (["light", "midsize", "supermid"] as AircraftCategorySlug[]))
    .map((k) => cats.find((c) => c.slug === k))
    .filter((c): c is BoardCategory => Boolean(c));

  return (
    <>
      <div className="mt-4 grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {cats.map((c) => (
          <article key={c.slug} className="flex flex-col border border-line bg-surface">
            <button
              type="button"
              onClick={() => setQuick(c.slug)}
              aria-label={`Quick view: ${c.name}`}
              className="relative block aspect-[16/8] w-full cursor-pointer overflow-hidden border-0 bg-surface-2 p-0"
            >
              <Image src={c.image} alt="" fill sizes="(max-width: 640px) 100vw, 220px" className="object-cover transition-transform duration-500 hover:scale-[1.03]" />
            </button>
            <div className="flex flex-1 flex-col px-[14px] pb-[14px] pt-3">
              <div className="flex flex-col items-start gap-1.5">
                <h3 className="font-serif text-[21px] font-normal leading-[1.1] [text-wrap:balance]">{c.name}</h3>
                <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[12px] text-steel">
                  <input
                    type="checkbox"
                    checked={sel.includes(c.slug)}
                    disabled={!sel.includes(c.slug) && sel.length >= MAX}
                    onChange={() => toggle(c.slug)}
                    className="m-0 h-[14px] w-[14px] accent-[var(--gold)] max-sm:h-6 max-sm:w-6"
                  />
                  Compare
                </label>
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.45] text-steel">{c.body}</p>
              <p className="mt-1.5 text-[12px] text-steel">
                <b className="text-bone">Examples:</b> {c.examples}
              </p>
              <Link href={c.href} className="text-link mt-auto pt-[10px] text-[13px] font-bold">
                Explore {c.name.toLowerCase()} →
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[12px] text-steel">
          Representative examples, not live inventory. Capacity, equipment and performance vary by model and configuration.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] text-steel" aria-live="polite">
            {sel.length ? `${sel.length} of ${MAX} selected` : `Select up to ${MAX} categories`}
          </span>
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-[14px] w-[14px] border border-gold ${i < sel.length ? "bg-gold" : ""}`} />
            ))}
          </span>
          <button
            type="button"
            onClick={() => setCompare(true)}
            className="h-[34px] rounded-[2px] border border-gold bg-white px-[14px] text-[13px] font-bold text-gold hover:bg-surface-2"
          >
            Compare categories →
          </button>
        </div>
      </div>

      <LightWindow open={Boolean(q)} onClose={() => setQuick(null)} variant="drawer" title={q?.name} sub={q?.sub}>
        {q ? (
          <>
            <div className="relative mt-[14px] aspect-[16/9] overflow-hidden rounded-[3px] bg-surface-2">
              <Image src={q.image} alt="" fill sizes="440px" className="object-cover" />
              <span className="absolute bottom-1.5 left-2 text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">Illustrative imagery</span>
            </div>
            <div className="mt-4 grid grid-cols-[26px_minmax(0,1fr)] gap-3">
              <LineIcon name="check" size={22} />
              <div>
                <b className="text-[14px]">Good fit</b>
                <p className="mt-0.5 text-[13px] text-steel">{q.fit}</p>
                <p className="mt-1 text-[13px] text-steel">
                  Up to {q.pax} passengers · {q.range} typical published range.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[26px_minmax(0,1fr)] gap-3">
              <LineIcon name="doc" size={22} />
              <div>
                <b className="text-[14px]">Check before you choose</b>
                {[
                  ["Cabin layout", "Confirm seating and cabin configuration."],
                  ["Baggage dimensions", "Check space for your baggage and special items."],
                  ["Nonstop route assessment", "Confirm the aircraft can operate your route."],
                ].map(([a, b]) => (
                  <div key={a} className="mt-1.5 text-[13px]">
                    <b className="block">{a}</b>
                    <span className="text-steel">{b}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[13px] font-bold">Example aircraft in this category</p>
            <div className="mt-2 grid grid-cols-2 gap-[10px]">
              {q.samples.slice(0, 2).map((s) => (
                <Link key={s.name} href={s.href ?? q.href} className="block text-[13px] hover:text-gold">
                  <span className="relative block aspect-[16/9] overflow-hidden rounded-[3px] bg-surface-2">
                    {s.image ? <Image src={s.image} alt="" fill sizes="200px" className="object-cover" /> : null}
                  </span>
                  <span className="mt-1 block font-bold">{s.name} →</span>
                </Link>
              ))}
            </div>
            <p className="mt-[10px] text-[12px] text-steel">Illustrative examples. Availability varies.</p>
            <div className="mt-4 grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
              <Link href={q.href} className="btn btn-primary">
                Explore {q.name.toLowerCase()} →
              </Link>
              <button
                type="button"
                onClick={() => toggle(q.slug)}
                disabled={!sel.includes(q.slug) && sel.length >= MAX}
                className="btn btn-secondary disabled:opacity-50"
              >
                {sel.includes(q.slug) ? "✓ Added to comparison" : "Add to comparison"}
              </button>
            </div>
          </>
        ) : null}
      </LightWindow>

      <LightWindow
        open={compare}
        onClose={() => setCompare(false)}
        width={900}
        title="Compare your shortlist"
        sub={
          sel.length
            ? "Typical features of each category. The exact aircraft, layout and amenities are confirmed in your proposal."
            : "No categories ticked yet — here are three to start with. Tick up to three cards to build your own shortlist."
        }
      >
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[13px] leading-[1.45]">
            <thead>
              <tr>
                <th className="w-[120px]" />
                {shortlist.map((c) => (
                  <th key={c.slug} className="border-l border-line px-3 pb-2 text-left align-top font-serif text-[18px] font-normal">
                    {c.name}
                    <span className="relative mt-2 block aspect-[16/9] overflow-hidden rounded-[3px] bg-surface-2">
                      <Image src={c.image} alt="" fill sizes="180px" className="object-cover" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["people", "Passengers", (c: BoardCategory) => `Up to ${c.pax}`],
                  ["plane", "Typical range", (c: BoardCategory) => c.range],
                  ["seat", "Cabin priority", (c: BoardCategory) => c.cabin],
                  ["bag", "Baggage to confirm", (c: BoardCategory) => c.bags],
                  ["pin", "Route assessment", () => "Confirm the aircraft can operate your route and airport requirements."],
                ] as const
              ).map(([icon, label, get]) => (
                <tr key={label}>
                  <th scope="row" className="border-t border-line py-3 pr-3 text-left align-top font-bold">
                    <span className="flex items-center gap-2">
                      <LineIcon name={icon} size={18} />
                      {label}
                    </span>
                  </th>
                  {shortlist.map((c) => (
                    <td key={c.slug} className="border-l border-t border-line px-3 py-3 align-top text-steel">
                      {get(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-steel">Compare the specific aircraft offered, not category labels alone.</span>
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCompare(false)} className="btn btn-secondary">
              Edit selection
            </button>
            <Link href="/quote/mission" className="btn btn-primary">
              Request aircraft options →
            </Link>
          </span>
        </div>
      </LightWindow>
    </>
  );
}
