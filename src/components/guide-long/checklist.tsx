"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { WindowButton } from "@/components/light/window";

const read = (key: string): Record<number, boolean> => {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
};
const write = (key: string, v: Record<number, boolean>) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked — the checklist still works for this visit */
  }
};

/**
 * Inline tick-list from the guide asides ("Before you approve."). Ticks
 * are local to the visit; nothing is sent anywhere.
 */
export function MiniChecklist({ items, size = 16, className = "" }: { items: string[]; size?: 16 | 18; className?: string }) {
  const [on, setOn] = useState<Record<number, boolean>>({});
  return (
    <div className={`flex flex-col ${size === 18 ? "gap-[10px] text-[14px]" : "gap-[9px] text-[13px] text-bone-2"} ${className}`}>
      {items.map((t, i) => (
        <label key={t} className="flex cursor-pointer items-center gap-[10px]">
          <input
            type="checkbox"
            checked={!!on[i]}
            onChange={() => setOn((s) => ({ ...s, [i]: !s[i] }))}
            className="m-0 flex-none accent-[var(--gold)]"
            style={{ width: size, height: size }}
          />
          <span>{t}</span>
        </label>
      ))}
    </div>
  );
}

function ChecklistBody({ items, storageKey }: { items: string[]; storageKey: string }) {
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  useEffect(() => setSaved(read(storageKey)), [storageKey]);
  const n = items.filter((_, i) => saved[i]).length;
  const toggle = (i: number) =>
    setSaved((s) => {
      const next = { ...s, [i]: !s[i] };
      write(storageKey, next);
      return next;
    });
  return (
    <>
      <p className="mt-[6px] text-[14px] text-steel" aria-live="polite">
        {n} of {items.length} confirmed · saved on this device
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((t, i) => (
          <label
            key={t}
            className={`flex cursor-pointer items-start gap-3 rounded-[2px] border bg-white px-3 py-[10px] text-[14px] leading-[1.45] ${saved[i] ? "border-gold" : "border-line"}`}
          >
            <input
              type="checkbox"
              checked={!!saved[i]}
              onChange={() => toggle(i)}
              className="m-0 mt-[2px] h-4 w-4 flex-none accent-[var(--navy)]"
            />
            {t}
          </label>
        ))}
      </div>
      <div className="mt-[18px] flex flex-wrap gap-[10px]">
        <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-sm">
          Print checklist
        </button>
        <Link href="/contact" className="btn btn-secondary btn-sm">
          Ask about an item
        </Link>
      </div>
      <p className="mt-[14px] text-[12px] leading-[1.5] text-steel">
        A checklist does not confirm a booking. Confirm each item in your written agreement.
      </p>
    </>
  );
}

/**
 * The boards' "Open full checklist" drawer: the page's checklist with
 * ticks remembered on this device, a print button and a route to ask.
 */
export function ChecklistWindow({
  label,
  className,
  title = "Before you book.",
  items,
  storageKey,
}: {
  label: ReactNode;
  className?: string;
  title?: string;
  items: string[];
  storageKey: string;
}) {
  return (
    <WindowButton
      label={label}
      className={className}
      variant="drawer"
      title={
        <>
          <span className="mb-2 block font-sans text-[12px] font-bold uppercase tracking-[.2em] text-gold">Checklist</span>
          {title}
        </>
      }
    >
      <ChecklistBody items={items} storageKey={`jn-guide:${storageKey}`} />
    </WindowButton>
  );
}
