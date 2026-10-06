"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LightWindow } from "@/components/light/window";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { LineIcon } from "./line-icon";
import { QuoteLink } from "./quote-link";

export type ModelCardData = {
  ref: string;
  name: string;
  headline: string;
  detail: string;
  image?: string;
  href?: string;
  source: { label: string; href: string };
  category: AircraftCategorySlug;
  pax: number;
};

/**
 * Model row from the category template ("Three models…"): photo, maker
 * eyebrow, name, published figures, the desk's note, model page and
 * manufacturer links. Photo and "Quick view" open the model preview
 * drawer (JNM "quick"); "Request this model" seeds the quote.
 */
export function ModelCard({ m }: { m: ModelCardData }) {
  const [open, setOpen] = useState(false);
  const ext = m.source.href.startsWith("http");
  return (
    <article className="flex flex-wrap gap-x-[18px] gap-y-3 border border-line bg-surface p-[10px]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Quick view: ${m.name}`}
        className="relative aspect-[16/10] max-w-full flex-[1_1_230px] cursor-pointer overflow-hidden border-0 bg-surface-2 p-0"
      >
        {m.image ? <Image src={m.image} alt={`${m.name} exterior`} fill sizes="(max-width: 640px) 100vw, 300px" className="object-cover" /> : null}
        <span className="absolute bottom-1.5 right-2 whitespace-nowrap font-serif text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
          Illustrative
        </span>
      </button>
      <div className="min-w-0 flex-[999_1_260px] py-1.5 pr-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">{m.ref}</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-7 rounded-[2px] border border-bone bg-white px-3 text-[12px] text-bone hover:bg-surface-2"
          >
            Quick view
          </button>
        </div>
        <h3 className="mt-1 font-serif text-[26px] font-normal leading-[1.1]">{m.name}</h3>
        <p className="mt-1.5 text-[14px] font-bold">{m.headline}</p>
        <p className="mt-1 text-[13px] leading-[1.45] text-steel">{m.detail}</p>
        <div className="mt-[10px] flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          {m.href ? (
            <Link href={m.href} className="border-b border-bone pb-px hover:text-gold">
              Explore model →
            </Link>
          ) : null}
          <a
            href={m.source.href}
            {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="whitespace-nowrap border-b border-bone pb-px hover:text-gold"
          >
            {m.source.label} ↗
          </a>
        </div>
      </div>

      <LightWindow open={open} onClose={() => setOpen(false)} variant="drawer" title={m.name}>
        <p className="eyebrow mt-2">Model preview · {m.ref}</p>
        <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
          {m.image ? <Image src={m.image} alt="" fill sizes="440px" className="object-cover" /> : null}
          <span className="absolute bottom-1.5 right-2 font-serif text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">Illustrative imagery</span>
        </div>
        <p className="mt-[14px] font-serif text-[15px] font-bold">{m.headline}</p>
        <p className="mt-1 text-[13px] leading-[1.5] text-steel">{m.detail}</p>
        <h3 className="mb-1 mt-4 font-serif text-[18px] font-normal">Confirm for your flight</h3>
        <ul>
          {(
            [
              ["Usable passenger seats and layout", "seat"],
              ["Bag sizes, weights and loading access", "bag"],
              ["Route suitability and possible fuel stops", "plane"],
            ] as const
          ).map(([t, icon]) => (
            <li key={t} className="flex items-center gap-3 border-t border-line py-[9px] font-serif text-[14px]">
              <LineIcon name={icon} size={20} />
              {t}
            </li>
          ))}
        </ul>
        <QuoteLink
          context={`model-quick:${m.name}`}
          category={m.category}
          pax={Math.min(m.pax, 8)}
          className="btn btn-primary mt-4 w-full"
        >
          Request this model →
        </QuoteLink>
        <div className="mt-[10px] grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
          {m.href ? (
            <Link href={m.href} className="btn btn-secondary">
              Full model page →
            </Link>
          ) : null}
          <a href={m.source.href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="btn btn-secondary whitespace-nowrap">
            {m.source.label} ↗
          </a>
        </div>
        <p className="mt-3 text-center text-[12px] text-steel">Model reference, not a live aircraft listing.</p>
      </LightWindow>
    </article>
  );
}
