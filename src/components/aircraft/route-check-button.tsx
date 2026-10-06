"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { LightWindow } from "@/components/light/window";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { LineIcon } from "./line-icon";
import { startAircraftQuote } from "./start-aircraft-quote";
import { inputCls } from "./trip-form";

const PAX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
const labelCls = "flex min-w-0 flex-col gap-1 text-[12px] font-bold";

/**
 * "Can this aircraft fly my route?" window (JNP "routeCheck" / JNM
 * "route"). The route assessment request becomes a seeded quote: the
 * fields fill the draft and the visitor continues in /quote/mission.
 */
export function RouteCheckButton({
  label,
  className = "",
  context,
  category,
  title = "Can this aircraft fly my route?",
}: {
  label: React.ReactNode;
  className?: string;
  context: string;
  category?: AircraftCategorySlug;
  title?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const bags = (d.get("bags") as string)?.trim();
    startAircraftQuote({
      context,
      category,
      pax: Number(d.get("pax")) || undefined,
      from: (d.get("from") as string) || undefined,
      to: (d.get("to") as string) || undefined,
      depart: (d.get("depart") as string) || undefined,
      notes: bags ? `Route check · baggage: ${bags}` : "Route check: please confirm nonstop feasibility.",
    });
    router.push("/quote/mission");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`cursor-pointer ${className}`}>
        {label}
      </button>
      <LightWindow
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        sub="Confirm your route and key details. The operating carrier will review feasibility for your itinerary."
      >
        <form onSubmit={onSubmit} className="mt-4">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
            <label className={labelCls} htmlFor={`${id}-from`}>
              <span>From</span>
              <input id={`${id}-from`} name="from" required placeholder="City or airport" autoComplete="off" className={inputCls} />
            </label>
            <label className={labelCls} htmlFor={`${id}-to`}>
              <span>To</span>
              <input id={`${id}-to`} name="to" required placeholder="City or airport" autoComplete="off" className={inputCls} />
            </label>
            <label className={labelCls} htmlFor={`${id}-date`}>
              <span>Travel date</span>
              <input id={`${id}-date`} name="depart" type="date" className={inputCls} />
            </label>
            <label className={labelCls} htmlFor={`${id}-pax`}>
              <span>Passengers</span>
              <select id={`${id}-pax`} name="pax" defaultValue="6" className={`${inputCls} px-2`}>
                {PAX.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${labelCls} col-span-full`} htmlFor={`${id}-bags`}>
              <span>
                Additional baggage <span className="font-normal text-steel">(optional)</span>
              </span>
              <input id={`${id}-bags`} name="bags" placeholder="e.g. golf clubs, oversized items" className={inputCls} />
            </label>
          </div>
          <div className="relative mt-4 aspect-[16/6] overflow-hidden rounded-[3px] bg-surface-2">
            <Image src="/images/light/jet-ultra-flight.webp" alt="" fill sizes="600px" className="object-cover" />
            <span className="absolute bottom-1.5 left-2 text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">Illustrative imagery</span>
          </div>
          <div className="mt-4 grid grid-cols-[26px_minmax(0,1fr)] gap-3 bg-surface-2 px-4 py-3 text-[13px] leading-[1.5]">
            <LineIcon name="plane" size={22} />
            <div>
              <b>Route review required</b>
              <p className="mt-0.5 text-steel">
                Published range is a starting point. Passenger load, baggage, winds, speed and airport conditions affect nonstop
                capability. The operating carrier confirms feasibility for your itinerary.
              </p>
            </div>
          </div>
          <button type="submit" className="mt-4 h-[46px] w-full rounded-[2px] bg-clearance text-[14px] font-bold text-white hover:bg-clearance-hover">
            Request a route assessment <span aria-hidden="true">→</span>
          </button>
          <p className="mt-2 text-[12px] text-steel">Continues to the quote form with these details filled in. No automatic nonstop or availability guarantee.</p>
        </form>
      </LightWindow>
    </>
  );
}
