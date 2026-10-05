"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { LightWindow } from "@/components/light/window";
import { seedQuote } from "@/lib/start-quote";
import { useQuoteStore } from "@/lib/quote-store";
import { track } from "@/lib/analytics";

type Field = { label: string; placeholder: string };

const PAX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];

/**
 * Hand a guide's trip brief to the quote wizard: route, date and
 * passengers seed the quote store (seedQuote), and the guide-specific
 * answers travel as the wizard's notes. Every brief ends at
 * /quote/mission — the prototype's "brief sent" screen is replaced by the
 * real flow.
 */
function useSubmitBrief(fields: Field[], context: string) {
  const router = useRouter();
  return (e: FormEvent<HTMLFormElement>, trip: "oneway" | "roundtrip") => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const str = (k: string) => ((d.get(k) as string | null) ?? "").trim();
    seedQuote({
      trip,
      pax: Number(str("pax")) || 4,
      from: str("from") || undefined,
      to: str("to") || undefined,
      depart: str("date") || undefined,
    });
    const notes = [
      ...fields.map((f, i) => (str(`f${i}`) ? `${f.label}: ${str(`f${i}`)}` : "")),
      str("notes"),
    ].filter(Boolean);
    if (notes.length) useQuoteStore.getState().setNotes(notes.join("\n"));
    track("quote_launcher_submitted", { context });
    router.push("/quote/mission");
  };
}

function Fields({ fields, idPrefix, pax }: { fields: Field[]; idPrefix: string; pax: "select" | "number" }) {
  return (
    <>
      <div className="field-jn">
        <label htmlFor={`${idPrefix}-from`}>From</label>
        <input id={`${idPrefix}-from`} name="from" placeholder="Departure airport" autoComplete="off" />
      </div>
      <div className="field-jn">
        <label htmlFor={`${idPrefix}-to`}>To</label>
        <input id={`${idPrefix}-to`} name="to" placeholder="Arrival airport" autoComplete="off" />
      </div>
      <div className={pax === "number" ? "grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-[10px]" : "contents"}>
        <div className="field-jn">
          <label htmlFor={`${idPrefix}-date`}>Travel date</label>
          <input id={`${idPrefix}-date`} name="date" type="date" />
        </div>
        <div className="field-jn">
          <label htmlFor={`${idPrefix}-pax`}>Passengers</label>
          <select id={`${idPrefix}-pax`} name="pax" defaultValue="4">
            {PAX.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      {fields.map((f, i) => (
        <div key={f.label} className="field-jn">
          <label htmlFor={`${idPrefix}-f${i}`}>{f.label}</label>
          <input id={`${idPrefix}-f${i}`} name={`f${i}`} placeholder={f.placeholder} autoComplete="off" />
        </div>
      ))}
    </>
  );
}

/** The trip-brief panel beside the guide sections. */
export function BriefPanel({
  title,
  fields,
  context,
  sideImg,
}: {
  title: string;
  fields: Field[];
  context: string;
  sideImg?: ReactNode;
}) {
  const submit = useSubmitBrief(fields, context);
  return (
    <form
      onSubmit={(e) => submit(e, "oneway")}
      className="min-w-0 max-w-[340px] flex-[1_1_260px] overflow-hidden border border-line bg-surface p-[18px] max-md:max-w-none"
    >
      <h2 className="font-serif text-[24px] leading-[1.1]">{title}</h2>
      <p className="mb-3 mt-[6px] text-[13px] text-steel">Tell us about your trip and we will come back with suitable options.</p>
      <div className="flex flex-col gap-[10px]">
        <Fields fields={fields} idPrefix={`${context}-side`} pax="select" />
      </div>
      <button type="submit" className="btn btn-primary mt-[14px] h-[42px] w-full text-[14px] font-bold">
        Send my trip brief <span aria-hidden="true">→</span>
      </button>
      <p className="mt-2 text-[12px] text-steel">Operator confirmation required. An inquiry is not a booking.</p>
      <div className="mt-3 flex flex-col gap-[6px] text-[13px]">
        <Link href="/aircraft" className="w-fit whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
          Explore aircraft →
        </Link>
        <Link href="/cost-calculator" className="w-fit whitespace-nowrap underline underline-offset-[3px] hover:text-gold">
          Estimate trip cost →
        </Link>
      </div>
      {sideImg}
    </form>
  );
}

/** A button that opens the trip-brief drawer (hero + closing band). */
export function BriefButton({
  label,
  title,
  fields,
  context,
  className,
}: {
  label: ReactNode;
  title: string;
  fields: Field[];
  context: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [trip, setTrip] = useState<"oneway" | "roundtrip">("oneway");
  const submit = useSubmitBrief(fields, context);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <LightWindow open={open} onClose={() => setOpen(false)} title={title} sub="Tell us what matters for your flight." variant="drawer">
        <form onSubmit={(e) => submit(e, trip)} className="mt-[18px] flex flex-col gap-3">
          <div role="radiogroup" aria-label="Journey" className="grid grid-cols-2 overflow-hidden rounded-control border border-line">
            {(
              [
                ["oneway", "One way"],
                ["roundtrip", "Round trip"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={trip === k}
                onClick={() => setTrip(k)}
                className={`h-[38px] border-0 text-[13px] font-bold ${trip === k ? "bg-navy text-white" : "bg-surface text-bone"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Fields fields={fields} idPrefix={`${context}-drawer`} pax="number" />
          <div className="field-jn">
            <label htmlFor={`${context}-drawer-notes`}>
              Anything else we should know? <span className="font-normal text-steel">(optional)</span>
            </label>
            <textarea id={`${context}-drawer-notes`} name="notes" rows={3} placeholder="Fragile items, extra equipment or access needs" />
          </div>
          <p className="bg-surface-2 px-3 py-[10px] text-[12px] text-steel">Aircraft and feasibility require operator confirmation.</p>
          <button type="submit" className="btn btn-primary h-[44px] w-full text-[14px] font-bold">
            Send my trip brief <span aria-hidden="true">→</span>
          </button>
          <button type="button" onClick={() => setOpen(false)} className="w-fit self-center border-0 bg-transparent p-0 text-[13px] underline underline-offset-[3px]">
            Back to guide
          </button>
        </form>
      </LightWindow>
    </>
  );
}
