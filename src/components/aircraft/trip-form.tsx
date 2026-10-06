"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { SITE } from "@/lib/constants";
import { LineIcon } from "./line-icon";
import { startAircraftQuote } from "./start-aircraft-quote";

const PAX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];

export const inputCls =
  "h-[38px] w-full min-w-0 rounded-[3px] border border-line bg-white px-[10px] text-[16px] text-bone outline-none placeholder:text-steel-dim focus:border-bone sm:text-[14px]";
const labelCls = "flex min-w-0 flex-col gap-1 text-[12px] font-bold text-bone";

/**
 * Trip form from the light aircraft templates. `hub` is the Aircraft
 * page's hero card ("Start with your trip", one way / round trip);
 * `side` is the category and model pages' sticky side box with a needs
 * field and the dispatch phone. Both seed the quote draft and open
 * /quote/mission — nothing is sent from here.
 */
export function TripForm({
  variant,
  title,
  context,
  category,
  button,
  defaultPax,
}: {
  variant: "hub" | "side";
  title: string;
  context: string;
  category?: AircraftCategorySlug;
  button?: string;
  defaultPax?: number;
}) {
  const router = useRouter();
  const id = useId();
  const [trip, setTrip] = useState<"oneway" | "roundtrip">("oneway");
  const [needsOpen, setNeedsOpen] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    startAircraftQuote({
      context,
      category,
      trip: variant === "hub" ? trip : "oneway",
      pax: Number(d.get("pax")) || defaultPax,
      from: (d.get("from") as string) || undefined,
      to: (d.get("to") as string) || undefined,
      depart: (d.get("depart") as string) || undefined,
      notes: (d.get("notes") as string) || undefined,
    });
    router.push("/quote/mission");
  }

  const fields = (
    <>
      <label className={labelCls} htmlFor={`${id}-from`}>
        <span>From</span>
        <input id={`${id}-from`} name="from" placeholder="City or airport" autoComplete="off" className={inputCls} />
      </label>
      <label className={labelCls} htmlFor={`${id}-to`}>
        <span>To</span>
        <input id={`${id}-to`} name="to" placeholder="City or airport" autoComplete="off" className={inputCls} />
      </label>
      <label className={labelCls} htmlFor={`${id}-date`}>
        <span>{variant === "hub" ? "Departure date" : "Departure"}</span>
        <input id={`${id}-date`} name="depart" type="date" className={inputCls} />
      </label>
      <label className={labelCls} htmlFor={`${id}-pax`}>
        <span>Passengers</span>
        <select id={`${id}-pax`} name="pax" defaultValue={defaultPax ? String(defaultPax) : ""} className={`${inputCls} px-2`}>
          <option value="">Select</option>
          {PAX.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  if (variant === "hub") {
    return (
      <form onSubmit={onSubmit} className="border border-line bg-white px-5 pb-4 pt-[18px] shadow-[0_12px_34px_rgba(18,35,46,0.1)]">
        <h2 className="font-serif text-[22px] font-normal leading-[1.15]">{title}</h2>
        <div role="radiogroup" aria-label="Trip type" className="mt-3 grid grid-flow-col auto-cols-fr overflow-hidden rounded-[3px] border border-line">
          {(
            [
              ["oneway", "One way"],
              ["roundtrip", "Round trip"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={trip === k}
              onClick={() => setTrip(k)}
              className={`h-[34px] text-[13px] ${trip === k ? "bg-clearance font-bold text-white" : "bg-white text-bone"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-x-3 gap-y-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr))]">{fields}</div>
        <button
          type="button"
          aria-expanded={needsOpen}
          aria-controls={`${id}-notes`}
          onClick={() => setNeedsOpen((v) => !v)}
          className="mt-[10px] flex h-[38px] w-full items-center justify-between rounded-[3px] border border-line bg-ink px-[10px] text-[13px] text-steel"
        >
          <span>Bags, pets or cabin priorities</span>
          <span aria-hidden="true" className="text-[16px] text-bone">
            {needsOpen ? "−" : "+"}
          </span>
        </button>
        {needsOpen ? (
          <textarea
            id={`${id}-notes`}
            name="notes"
            rows={2}
            maxLength={800}
            aria-label="Bags, pets or cabin priorities"
            placeholder="Bag sizes, golf clubs, pets, Wi-Fi, sleeping positions…"
            className={`${inputCls} mt-2 h-auto py-2 leading-[1.45]`}
          />
        ) : null}
        <button type="submit" className="mt-3 h-[42px] w-full rounded-[2px] bg-clearance text-[14px] font-bold text-white hover:bg-clearance-hover">
          {button ?? "Find aircraft options"} <span aria-hidden="true">→</span>
        </button>
        <p className="mt-2 text-[12px] leading-[1.4] text-steel">Aircraft, availability and total price confirmed in your proposal.</p>
        <div className="mt-2 text-center">
          <Link href="/how-it-works" className="text-link whitespace-nowrap text-[12px] font-bold">
            How booking works →
          </Link>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border border-line bg-surface px-[18px] pb-4 pt-[18px]">
      <h2 className="font-serif text-[22px] font-normal leading-[1.15]">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-[10px] max-[340px]:grid-cols-1">
        {fields}
        <label className={`${labelCls} col-span-full`} htmlFor={`${id}-notes`}>
          <span>
            Baggage &amp; special requests <span className="font-normal text-steel">(optional)</span>
          </span>
          <textarea
            id={`${id}-notes`}
            name="notes"
            rows={2}
            maxLength={800}
            placeholder="Tell us about your bags, oversized items or anything else we should know."
            className={`${inputCls} h-auto resize-y py-2 leading-[1.45]`}
          />
        </label>
      </div>
      <button type="submit" className="mt-3 h-10 w-full rounded-[2px] bg-clearance text-[14px] font-bold text-white hover:bg-clearance-hover">
        {button ?? "Request options"} <span aria-hidden="true">→</span>
      </button>
      <p className="mt-2 text-[12px] text-steel">Aircraft, availability and final pricing require confirmation.</p>
      <a href={`tel:${SITE.dispatchPhoneE164}`} className="mt-2 flex items-center gap-2 text-[13px] hover:text-gold">
        <LineIcon name="phone" size={16} />
        {SITE.dispatchPhone}
      </a>
    </form>
  );
}
