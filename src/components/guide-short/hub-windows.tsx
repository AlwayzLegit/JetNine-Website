"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { LibraryGuide } from "@/lib/guides-short";
import { GIcon, InfoIcon, type GuideIconName } from "./icons";

/* Window bodies for the guides library (jn-pack-windows.js: preBooking,
   nbaa "cards", faa, guidePreview). Rendered inside LightWindow /
   WindowButton, which supply the title and close button. */

const FAA_URL = "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft";
const NBAA_URL =
  "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/";

function Check({ id, label, defaultChecked = false, onChange }: { id: string; label: string; defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-[10px] py-[6px] text-[13px]">
      <input
        id={id}
        type="checkbox"
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="m-0 h-4 w-4 flex-none accent-[var(--gold)]"
      />
      {label}
    </label>
  );
}

const PRE: [GuideIconName, string, string[]][] = [
  ["clock", "Trip details", ["Dates, route and passengers", "Bags, pets and cabin needs"]],
  ["plane", "Aircraft & operator", ["Identify operating carrier", "Confirm aircraft and layout"]],
  ["doc", "Total price & extras", ["Review itemized total price", "Confirm possible extra charges"]],
  ["gear", "Changes & cancellation", ["Review deadlines and fees", "Check substitution and refund terms"]],
];

export function PreBookingChecklist({ onClose }: { onClose: () => void }) {
  const total = PRE.reduce((n, c) => n + c[2].length, 0);
  const [count, setCount] = useState(1);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-steel">Use this checklist alongside your written proposal.</p>
        <div className="min-w-[160px]">
          <span className="text-[12px] text-steel" aria-live="polite">
            {count} of {total} items reviewed
          </span>
          <div className="mt-[6px] h-[6px] overflow-hidden rounded-[3px] bg-surface-2">
            <div className="h-full bg-gold" style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-[10px]">
        {PRE.map(([ic, t, items], ci) => (
          <div key={t} className="rounded-[3px] border border-line bg-surface p-3">
            <GIcon name={ic} size={26} />
            <b className="mt-2 block text-[13px]">{t}</b>
            {items.map((l, i) => (
              <Check key={l} id={`pb-${ci}-${i}`} label={l} defaultChecked={ci === 0 && i === 0} onChange={(v) => setCount((n) => n + (v ? 1 : -1))} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-[10px]">
        <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-sm">
          Print checklist
        </button>
        <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
          Continue planning →
        </button>
      </div>
    </div>
  );
}

const NBAA: [GuideIconName, string, string][] = [
  ["plane", "Operating carrier and aircraft", "Confirm the carrier, aircraft model and configuration."],
  ["tag", "Total trip price and taxes", "Review what is included in the total price."],
  ["doc", "Substitution policy", "Understand when and why the aircraft may be substituted."],
  ["warn", "Potential extra charges", "Ask about likely additional costs (e.g. landing fees, handling, catering)."],
  ["seat", "Cabin and baggage fit", "Check that the cabin, baggage space and amenities meet your needs."],
  ["calendar", "Cancellation and refund terms", "Check the policy and timing for changes or cancellations."],
];

export function NbaaChecklist() {
  return (
    <div className="mt-2">
      <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[10px]">
        {NBAA.map(([ic, t, b], i) => (
          <label key={t} htmlFor={`nbaa-${i}`} className="grid cursor-pointer grid-cols-[18px_22px_minmax(0,1fr)] items-start gap-[10px] rounded-[3px] border border-line bg-surface p-3">
            <input id={`nbaa-${i}`} type="checkbox" className="m-0 mt-[2px] h-4 w-4 accent-[var(--gold)]" />
            <GIcon name={ic} size={20} />
            <span>
              <b className="block text-[13px]">{t}</b>
              <span className="text-[12px] leading-[1.4] text-steel">{b}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-[14px] flex items-center gap-[10px] bg-surface-2 px-3 py-[10px] text-[13px]">
        <InfoIcon />
        Ask the same questions of every proposal. Keep the answers in writing.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/guides/private-jet-charter-cost" className="text-link text-[14px] font-semibold">
          JetNine pricing guide →
        </Link>
        <span className="flex items-center gap-[10px]">
          <a href={NBAA_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            Read NBAA charter checklist ↗
          </a>
          <span className="text-[12px] text-steel">nbaa.org</span>
        </span>
      </div>
      <p className="mt-3 text-[12px] text-steel">Independent guidance. No endorsement implied.</p>
    </div>
  );
}

export function FaaGuidance() {
  const items: [string, string][] = [
    ["Who operates my flight?", "Ask for the name of the operating carrier — the air carrier that will operate your flight."],
    ["Can I see the air carrier certificate?", "Request the carrier’s FAA Air Carrier Certificate and confirm it is current."],
    ["Is this aircraft authorized for charter?", "Confirm the aircraft is authorized for on-demand charter operation under the carrier’s certificate."],
  ];
  return (
    <div className="mt-2">
      <ol className="mt-[10px]">
        {items.map(([t, b], i) => (
          <li key={t} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-b border-line py-3">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">{i + 1}</span>
            <span>
              <b className="block text-[14px]">{t}</b>
              <span className="text-[13px] text-steel">{b}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-[14px] flex items-center gap-[10px] bg-surface-2 px-3 py-[10px] text-[13px]">
        <GIcon name="shield" size={18} />
        JetNine arranges flights. Ask for the operating carrier details before booking.
      </p>
      <p className="mt-2 text-[12px] text-steel">FAA guidance is an independent reference, not an endorsement of JetNine.</p>
      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <a href={FAA_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
          Read original FAA guidance ↗
        </a>
        <span className="text-[12px] text-steel">faa.gov</span>
      </div>
    </div>
  );
}

export function GuidePreview({ guide, next }: { guide: LibraryGuide; next: LibraryGuide[] }) {
  return (
    <div>
      <div className="relative mt-4 aspect-[16/7] overflow-hidden bg-surface-2">
        <Image src={guide.img} alt="" fill sizes="600px" className="object-cover" />
      </div>
      <p className="mb-[6px] mt-4 font-serif text-[18px]">{guide.learn ? "What you’ll learn" : "In this guide"}</p>
      {guide.learn ? (
        guide.learn.map((l, i) => (
          <div key={l} className="flex items-center gap-[10px] py-[6px] text-[14px]">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">0{i + 1}</span>
            {l}
          </div>
        ))
      ) : (
        <p className="text-[14px] text-steel">{guide.body}</p>
      )}
      <div className="mt-[14px] border-t border-line pt-3">
        <p className="mb-[6px] text-[12px] font-bold">Suggested next reads</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-[10px]">
          {next.map((n) => (
            <Link key={n.href} href={n.href} className="grid grid-cols-[22px_minmax(0,1fr)] gap-[10px] text-[13px] text-bone hover:text-gold">
              <GIcon name="doc" size={20} />
              <span>
                <b className="block">{n.title} →</b>
                <span className="text-steel">{n.tag}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <Link href={guide.href} className="btn btn-primary mt-4">
        Read the full guide →
      </Link>
    </div>
  );
}
