"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { track } from "@/lib/analytics";
import { seedQuote } from "@/lib/start-quote";

const PAX: [string, number][] = [
  ["1–4", 4],
  ["5–7", 7],
  ["8–9", 9],
  ["10–14", 14],
  ["15+", 16],
];

/**
 * Navy "Find your starting point." box (Jet sizes board): route and
 * party size seed the quote store, then the wizard opens on the mission
 * step — the wizard proposes the aircraft categories that fit.
 */
export function StartingPointForm() {
  const router = useRouter();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    seedQuote({
      trip: "oneway",
      pax: Number(d.get("pax")) || 4,
      from: (d.get("from") as string) || undefined,
      to: (d.get("to") as string) || undefined,
    });
    track("quote_launcher_submitted", { context: "guide-start-form" });
    router.push("/quote/mission");
  }
  const input = "h-9 min-w-0 rounded-[2px] border-0 bg-white px-[10px] text-[13px] text-navy outline-none";
  return (
    <form onSubmit={onSubmit} className="bg-navy p-5 text-white">
      <h2 className="m-0 font-serif text-[26px] font-normal leading-[1.1] text-white">Find your starting point.</h2>
      <p className="mb-3 mt-[6px] text-[13px] text-navy-on-2">Tell us a little about your trip to compare suitable aircraft options.</p>
      <div className="mb-1 text-[12px] font-bold">Route</div>
      <div className="flex flex-wrap items-center gap-[6px]">
        <input name="from" aria-label="From" placeholder="From" autoComplete="off" className={`flex-[999_1_200px] ${input}`} />
        <span aria-hidden="true" className="min-w-0 flex-[1_1_18px] text-center">
          →
        </span>
        <input name="to" aria-label="To" placeholder="To" autoComplete="off" className={`flex-[999_1_200px] ${input}`} />
      </div>
      <label className="mt-[10px] flex flex-col gap-1 text-[12px] font-bold">
        <span>Passengers</span>
        <select name="pax" defaultValue="" className={`h-9 px-2 ${input}`}>
          <option value="">Select passengers</option>
          {PAX.map(([l, n]) => (
            <option key={l} value={n}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="mt-[14px] h-10 w-full cursor-pointer rounded-[2px] border-0 bg-gold text-[14px] font-bold text-white hover:brightness-110">
        Compare options →
      </button>
      <p className="mt-2 text-[12px] text-navy-on-2">A planning aid. Suitability requires operator confirmation.</p>
    </form>
  );
}
