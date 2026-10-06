"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LightWindow } from "@/components/light/window";
import type { GlossaryTerm } from "@/lib/guides-short";
import { GIcon, InfoIcon, type GuideIconName } from "./icons";

/* ------------------------------------------------------------------ */
/* Checklist: inline tick grid + "Open my checklist" drawer with a     */
/* progress bar and print. Both views share one state.                 */

export function GuideChecklist({ title, items }: { title: string; items: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const [open, setOpen] = useState(false);
  const count = done.filter(Boolean).length;
  const label = `${count} of ${items.length} reviewed`;
  const toggle = (i: number) => setDone((d) => d.map((v, j) => (j === i ? !v : v)));

  const list = (prefix: string, cols: boolean) => (
    <div className={cols ? "mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-[10px]" : "mt-[14px] flex flex-col gap-2"}>
      {items.map((label, i) => (
        <label key={label} htmlFor={`${prefix}-${i}`} className="flex cursor-pointer items-center gap-3 border border-line bg-surface px-[14px] py-3 text-[14px]">
          <input
            id={`${prefix}-${i}`}
            type="checkbox"
            checked={done[i]}
            onChange={() => toggle(i)}
            className="m-0 h-[18px] w-[18px] flex-none accent-[var(--gold)]"
          />
          {label}
        </label>
      ))}
    </div>
  );

  return (
    <section id="checklist" className="container-jn scroll-mt-[84px] pt-[30px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-serif text-[32px] leading-[1.1]">{title}</h2>
        <span className="text-[13px] text-steel" aria-live="polite">
          {label}
        </span>
      </div>
      {list("ck", true)}
      <div className="mt-3 flex flex-wrap items-center gap-3 bg-surface-2 px-4 py-[10px] text-[14px]">
        <InfoIcon />
        <span className="flex-[1_1_300px]">For U.S. charter, the FAA suggests checking the operator’s Air Carrier Certificate and aircraft authorization.</span>
        <Link href="/guides/private-jet-charter-safety-checklist" className="whitespace-nowrap text-[13px] underline underline-offset-[3px] hover:text-gold">
          Charter safety checklist →
        </Link>
      </div>
      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary h-[42px] text-[14px] font-bold">
          Open my checklist →
        </button>
        <Link href="/guides/how-to-compare-private-jet-quotes" className="whitespace-nowrap text-[14px] underline underline-offset-[3px] hover:text-gold">
          How to compare charter quotes →
        </Link>
      </div>
      <LightWindow open={open} onClose={() => setOpen(false)} title="Your checklist" sub="Confirm the details before accepting a quote." variant="drawer">
        <div className="mt-[18px]">
          <div className="text-[13px] font-bold">{label}</div>
          <div className="mt-[6px] h-[6px] bg-surface-2">
            <div className="h-full bg-gold" style={{ width: `${Math.round((count / items.length) * 100)}%` }} />
          </div>
          {list("ckd", false)}
          <p className="mt-3 bg-surface-2 px-3 py-[10px] text-[12px] text-steel">For U.S. charter, request the operator’s certificate and aircraft authorization.</p>
          <div className="mt-4 flex flex-wrap items-center gap-[14px]">
            <button type="button" onClick={() => window.print()} className="btn btn-primary h-[42px] text-[14px] font-bold">
              Print checklist
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border-0 bg-transparent p-0 text-[13px] underline underline-offset-[3px]">
              Return to guide
            </button>
          </div>
        </div>
      </LightWindow>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ accordion — first answer open, one at a time. Answers stay in   */
/* the DOM (hidden) so the FAQ text is always server-rendered.         */

export function GuideFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-2">
      {items.map((f, i) => {
        const on = open === i;
        return (
          <div key={f.q} className="border border-line bg-surface">
            <button
              type="button"
              aria-expanded={on}
              aria-controls={`faq-a-${i}`}
              onClick={() => setOpen(on ? -1 : i)}
              className="flex w-full items-center justify-between gap-[14px] border-0 bg-transparent px-4 py-3 text-left text-[15px] text-bone"
            >
              <span>{f.q}</span>
              <span aria-hidden="true" className="text-[18px] text-gold">
                {on ? "−" : "+"}
              </span>
            </button>
            <p id={`faq-a-${i}`} hidden={!on} className="mx-4 mb-[14px] text-[14px] leading-[1.5] text-steel">
              {f.a}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Glossary: search + category chips + grouped, expandable terms.      */

const CATS = ["Aircraft", "Pricing", "Airports", "Booking"] as const;
const CAT_ICON: Record<(typeof CATS)[number], GuideIconName> = { Aircraft: "plane", Pricing: "tag", Airports: "pin", Booking: "doc" };

export function GlossaryTerms({ title, terms }: { title: string; terms: GlossaryTerm[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"All" | (typeof CATS)[number]>("All");
  const [term, setTerm] = useState<string | null>(null);
  const ql = q.trim().toLowerCase();
  const filtered = useMemo(
    () => terms.filter((t) => (cat === "All" || t.category === cat) && (!ql || `${t.name} ${t.definition}`.toLowerCase().includes(ql))),
    [terms, cat, ql],
  );

  return (
    <>
      <h2 className="font-serif text-[32px] leading-[1.1]">{title}</h2>
      <label className="mt-[14px] flex h-[44px] items-center gap-[10px] border border-line bg-surface px-[14px]">
        <GIcon name="search" size={18} strokeWidth={1.6} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search terms"
          placeholder="Search terms, e.g. FBO or empty leg"
          className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-bone outline-none placeholder:text-steel"
        />
      </label>
      <div className="mt-[10px] flex flex-wrap items-center gap-2">
        {(["All", ...CATS] as const).map((k) => {
          const on = cat === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setCat(k)}
              className={`h-[34px] rounded-control border px-[14px] text-[13px] ${on ? "border-navy bg-navy text-white" : "border-line bg-surface text-bone"}`}
            >
              {k === "All" ? "All terms" : k}
            </button>
          );
        })}
        <span className="ml-auto text-[12px] text-steel">
          {filtered.length} of {terms.length} terms
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-[10px]">
        {CATS.map((k, gi) => {
          const list = filtered.filter((t) => t.category === k);
          if (!list.length) return null;
          return (
            <div key={k} className="border border-line bg-surface">
              <div className="flex items-center justify-between gap-[10px] border-b border-surface-2 px-4 py-[14px]">
                <span className="font-serif text-[24px]">
                  <span className="text-gold">0{gi + 1}</span> {k}
                </span>
                <GIcon name={CAT_ICON[k]} size={26} />
              </div>
              {list.map((t) => {
                const on = term === t.slug;
                return (
                  <div key={t.slug} id={`term-${t.slug}`} className="border-b border-surface-2 last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={on}
                      onClick={() => setTerm(on ? null : t.slug)}
                      className="grid w-full grid-cols-[minmax(90px,.8fr)_minmax(0,1.6fr)_20px] items-center gap-[10px] border-0 bg-transparent px-4 py-[10px] text-left text-bone"
                    >
                      <span className="text-[13px] font-bold">{t.name}</span>
                      <span className="text-[12px] leading-[1.4] text-steel">{t.definition}</span>
                      <span aria-hidden="true" className="h-[18px] w-[18px] rounded-full border border-gold text-center text-[13px] leading-[16px] text-gold">
                        {on ? "−" : "+"}
                      </span>
                    </button>
                    <div hidden={!on} className="px-4 pb-3 text-[13px] leading-[1.5]">
                      <p className="text-steel">{t.why}</p>
                      <p className="mb-[2px] mt-2 text-[12px] font-bold">What to ask</p>
                      {t.ask.map((a) => (
                        <p key={a} className="mt-[2px]">
                          · {a}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {!filtered.length ? <p className="mt-3 text-[14px] text-steel">No matching terms. Try another word, or ask us in the panel.</p> : null}
    </>
  );
}
