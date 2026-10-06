"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { WindowButton } from "@/components/light/window";
import { PROGRAMS, pickProgram, type ProgramKey } from "./programs";
import { CardTiersWindow, ReserveWindow } from "./windows";

const IMG: Record<ProgramKey, string> = {
  ondemand: "/images/light/jet-light.webp",
  card: "/images/light/cabin-supermid.webp",
  reserve: "/images/light/jet-mediterranean-sunset.webp",
};
const KIND: Record<ProgramKey, string> = {
  ondemand: "Pay per flight",
  card: "Pre-funded flying",
  reserve: "Priority planning",
};

function fit(hours: number, notice: string): [string, string] {
  if (hours < 25) return ["On-Demand fits", "Below 25 hours a year, trip-by-trip booking usually costs less than a deposit."];
  if (hours <= 100) return ["Compare Card + On-Demand", "Your routes and total trip costs determine the fit."];
  return [
    "Reserve is worth a conversation",
    notice === "same"
      ? "Frequent short-notice flying is where priority planning pays off."
      : "Over 100 hours a year, funded access and account support add up.",
  ];
}

const cta = "btn btn-primary mt-auto w-full !h-[42px] !text-[14px] !font-bold";

/**
 * "Find your fit" band + the three program cards (Light - Programs). The
 * hours slider highlights the matching program (on-demand < 25 h, Card
 * 25–100 h, Reserve > 100 h — same thresholds as before).
 */
export function ProgramFit() {
  const [hours, setHours] = useState(40);
  const [notice, setNotice] = useState("3");
  const pick = pickProgram(hours);
  const [fitTitle, fitSub] = fit(hours, notice);

  return (
    <>
      <section aria-label="Find your fit" className="container-jn pt-4">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4 border border-line bg-surface-2 px-7 py-[18px] max-sm:px-4">
          <h2 className="flex-none whitespace-nowrap font-serif text-[24px]">Find your fit</h2>
          <label className="flex min-w-[200px] max-w-[300px] flex-[1_1_220px] flex-col gap-[6px] max-sm:max-w-none">
            <span className="whitespace-nowrap text-[13px] font-bold">{hours} hours / year</span>
            <input
              type="range"
              min={5}
              max={200}
              step={5}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              aria-valuetext={`${hours} hours a year`}
              className="m-0 w-full accent-[var(--bone)]"
            />
          </label>
          <label className="flex items-center gap-3 whitespace-nowrap text-[13px] text-steel">
            Usual notice
            <select
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              className="h-9 rounded-[2px] border border-line bg-white px-[10px] text-[13px] text-bone"
            >
              <option value="same">Same day</option>
              <option value="24">24–48 hours</option>
              <option value="3">3+ days</option>
            </select>
          </label>
          <div
            aria-live="polite"
            className="ml-auto min-w-[min(100%,240px)] max-w-[320px] flex-[1_1_240px] border-l border-line pl-7 max-sm:ml-0 max-sm:max-w-none max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-3"
          >
            <div className="font-serif text-[19px] font-bold">{fitTitle}</div>
            <div className="text-[12px] text-steel">{fitSub}</div>
          </div>
        </div>
      </section>

      <section id="programs" className="container-jn scroll-mt-[var(--header-h)] pt-10">
        <h2 className="text-center font-serif text-[clamp(34px,9vw,44px)] leading-[1.1]">Choose how you fly.</h2>
        <p className="mt-[6px] text-center font-serif text-[17px] text-steel">
          Compare commitment, pricing and booking flexibility.
        </p>
        <div id="tiers" className="mt-[22px] grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {PROGRAMS.map((p, i) => {
            const hi = p.key === pick;
            return (
              <article
                key={p.key}
                aria-current={hi ? "true" : undefined}
                className={`flex flex-col border bg-white ${hi ? "border-gold shadow-[0_0_0_1px_var(--gold)]" : "border-line"}`}
              >
                <div className="relative aspect-[16/8] bg-surface-2">
                  <Image src={IMG[p.key]} alt="" aria-hidden fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col px-5 pb-5 pt-[18px]">
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-steel">
                    0{i + 1} / {KIND[p.key]}
                    {p.chip ? <span className="ml-2 normal-case tracking-normal text-gold">· {p.chip}</span> : null}
                  </p>
                  <h3 className="mt-[6px] font-serif text-[28px] leading-[1.1]">{p.name}</h3>
                  <div className="mt-2 font-serif text-[36px] leading-none">{p.price}</div>
                  <div className="mt-1 text-[13px] text-steel">{p.priceSub}</div>
                  <ul className="mb-[18px] mt-[14px] flex list-none flex-col gap-2 border-t border-line p-0 pt-[14px]">
                    {p.features.map((f) => (
                      <li key={f} className="grid grid-cols-[auto_1fr] gap-[10px] text-[14px] leading-[1.45]">
                        <span aria-hidden="true" className="text-gold">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {p.key === "card" ? (
                    <WindowButton label="Explore card tiers →" className={cta} title="JetNine Card" variant="drawer">
                      <CardTiersWindow />
                    </WindowButton>
                  ) : p.key === "reserve" ? (
                    <WindowButton label="Explore Reserve →" className={cta} variant="drawer">
                      <ReserveWindow />
                    </WindowButton>
                  ) : (
                    <Link href={p.cta.href} className={cta}>
                      {p.cta.label} →
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
