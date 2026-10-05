"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LightWindow } from "@/components/light/window";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { LineIcon, type IconName } from "./line-icon";
import { startAircraftQuote } from "./start-aircraft-quote";

export type ChecklistGroup = { icon?: IconName; title?: string; body?: string; items: string[] };

/**
 * Cabin checklist drawer (JNP "cabinChecklist"): ticked items count up a
 * progress bar; "Add … to my request" copies the ticked items into the
 * quote draft's notes and opens /quote/mission. A planning aid only.
 */
export function ChecklistButton({
  label,
  className = "",
  title = "Your cabin checklist",
  sub = "Tell us what matters for your trip. This helps match you with aircraft that fit your group, baggage and preferences.",
  groups,
  note = "Tell us bag dimensions and essential needs. Confirm details for the aircraft offered.",
  cta = "Add priorities to my request",
  context,
  category,
}: {
  label: React.ReactNode;
  className?: string;
  title?: string;
  sub?: string;
  groups: ChecklistGroup[];
  note?: string;
  cta?: string;
  context: string;
  category?: AircraftCategorySlug;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const all = groups.flatMap((g) => g.items);
  const count = all.filter((x) => on[x]).length;

  function submit() {
    const picked = all.filter((x) => on[x]);
    startAircraftQuote({
      context,
      category,
      notes: picked.length ? `Cabin checklist: ${picked.join("; ")}` : undefined,
    });
    router.push("/quote/mission");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`cursor-pointer ${className}`}>
        {label}
      </button>
      <LightWindow open={open} onClose={() => setOpen(false)} variant="drawer" title={title} sub={sub}>
        <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
          <b>
            {count} of {all.length} reviewed
          </b>
          <button type="button" onClick={() => setOn({})} className="border-0 bg-transparent p-0 text-[13px] text-steel underline underline-offset-4">
            Reset
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-[2px] bg-surface-2" aria-hidden="true">
          <div className="h-full bg-gold transition-[width] duration-200" style={{ width: `${all.length ? (count / all.length) * 100 : 0}%` }} />
        </div>
        <div className="mt-4">
          {groups.map((g, gi) => (
            <div key={g.title ?? gi} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-t border-line py-3 first:border-t-0">
              {g.icon ? <LineIcon name={g.icon} size={26} /> : <span />}
              <div>
                {g.title ? <b className="block text-[14px]">{g.title}</b> : null}
                {g.body ? <span className="block text-[13px] text-steel">{g.body}</span> : null}
                <ul className="mt-1">
                  {g.items.map((item) => (
                    <li key={item}>
                      <label className="flex cursor-pointer items-center gap-[10px] py-[7px] text-[14px]">
                        <input
                          type="checkbox"
                          checked={!!on[item]}
                          onChange={() => setOn((s) => ({ ...s, [item]: !s[item] }))}
                          className="h-4 w-4 flex-none accent-[var(--gold)] max-sm:h-6 max-sm:w-6"
                        />
                        {item}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-3 bg-surface-2 px-4 py-3 text-[13px] leading-[1.5]">
          <LineIcon name="bag" size={20} />
          <span>{note}</span>
        </div>
        <button type="button" onClick={submit} className="mt-4 h-[42px] w-full rounded-[2px] bg-clearance text-[14px] font-bold text-white hover:bg-clearance-hover">
          {cta} <span aria-hidden="true">→</span>
        </button>
        <p className="mt-[10px] text-[12px] text-steel">Planning aid; not an aircraft approval.</p>
      </LightWindow>
    </>
  );
}
