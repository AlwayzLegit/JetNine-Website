"use client";

import { useState } from "react";
import { LightWindow } from "@/components/light/window";
import { SITE } from "@/lib/constants";

/**
 * "Open booking checklist" (jn-pack2-windows.js V.checklist): a drawer of
 * tick-boxes over the five things to confirm. Ticks live only for the
 * open session — nothing is stored or sent.
 */
export function ChecklistWindow({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const n = items.filter((_, i) => checked[i]).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn h-[38px] cursor-pointer border-white bg-[rgba(18,35,46,.75)] px-4 text-[13px] font-bold text-white hover:bg-[rgba(18,35,46,.9)]"
      >
        Open booking checklist →
      </button>
      <LightWindow
        open={open}
        onClose={() => setOpen(false)}
        title="Before you book."
        sub={`${n} of ${items.length} confirmed`}
        variant="drawer"
      >
        <div className="mt-4 flex flex-col gap-2">
          {items.map((t, i) => (
            <label
              key={t}
              className={`flex cursor-pointer items-start gap-3 rounded-[2px] border bg-white px-3 py-[10px] text-[14px] leading-[1.45] ${checked[i] ? "border-gold" : "border-line"}`}
            >
              <input
                type="checkbox"
                checked={Boolean(checked[i])}
                onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })}
                className="mt-[2px] h-4 w-4 accent-[var(--bone)]"
              />
              {t}
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary btn-sm">
            Ask about an item · {SITE.dispatchPhone}
          </a>
        </div>
        <p className="mt-4 text-[12px] text-steel">
          A checklist does not confirm a booking. Confirm each item in your written agreement.
        </p>
      </LightWindow>
    </>
  );
}
