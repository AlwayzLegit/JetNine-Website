"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { seedQuote } from "@/lib/start-quote";

const PAX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];

/**
 * "Plan your flight" side box (jn-light-chrome.js <jn-planbox>): From, To,
 * Departure and Passengers stacked, then a full-width primary. Seeds the
 * quote store and opens /quote/mission, like the Home trip bar. Fields are
 * optional here — the wizard asks for whatever is missing.
 */
export function PlanBox({
  title = "Plan your flight",
  sub = "Start with your itinerary.",
  button = "Request a quote",
  note = "An inquiry is not a booking.",
  defaultPax = 4,
}: {
  title?: string;
  sub?: string;
  button?: string;
  note?: string;
  defaultPax?: number;
}) {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    seedQuote({
      trip: "oneway",
      pax: Number(d.get("pax")) || defaultPax,
      from: (d.get("from") as string) || undefined,
      to: (d.get("to") as string) || undefined,
      depart: (d.get("depart") as string) || undefined,
    });
    router.push("/quote/mission");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[3px] border border-line bg-white p-5">
      <h3 className="font-serif text-[22px] leading-[1.2]">{title}</h3>
      {sub.trim() ? <p className="mt-1 text-[13px] text-steel">{sub}</p> : null}
      <div className="mt-[14px] flex flex-col gap-[11px]">
        <div className="field-jn">
          <label htmlFor="plan-from">From</label>
          <input id="plan-from" name="from" placeholder="City or airport" autoComplete="off" />
        </div>
        <div className="field-jn">
          <label htmlFor="plan-to">To</label>
          <input id="plan-to" name="to" placeholder="City or airport" autoComplete="off" />
        </div>
        <div className="field-jn">
          <label htmlFor="plan-date">Departure</label>
          <input id="plan-date" name="depart" type="date" />
        </div>
        <div className="field-jn">
          <label htmlFor="plan-pax">Passengers</label>
          <select id="plan-pax" name="pax" defaultValue={String(defaultPax)}>
            {PAX.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" className="btn btn-primary mt-[14px] w-full">
        {button} <span aria-hidden="true">↗</span>
      </button>
      <p className="mt-[10px] text-[12px] text-steel">{note}</p>
    </form>
  );
}
