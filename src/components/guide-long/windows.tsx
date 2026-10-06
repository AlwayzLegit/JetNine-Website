import Link from "next/link";
import type { ReactNode } from "react";
import { WindowButton } from "@/components/light/window";

export type WindowSource = { name: string; used: string; url: string };

/**
 * The boards' "notes" windows (jn-pack2-windows.js V.notes): a short
 * list of what to ask, the authority behind it, and a route to the desk.
 * The prototype's "save notes on this device" fields are not carried
 * over — the window is reading matter, the agreement is the record.
 */
export function NotesWindow({
  label,
  className,
  eyebrow = "Notes for your booking",
  title,
  items,
  source,
  drawer = false,
}: {
  label: ReactNode;
  className?: string;
  eyebrow?: string;
  title: string;
  items: string[];
  source?: WindowSource;
  drawer?: boolean;
}) {
  return (
    <WindowButton
      label={label}
      className={className}
      variant={drawer ? "drawer" : "modal"}
      title={
        <>
          <span className="mb-2 block font-sans text-[12px] font-bold uppercase tracking-[.2em] text-gold">{eyebrow}</span>
          {title}
        </>
      }
      sub="Ask for these in writing for your specific flight."
    >
      <ul className="mt-[14px] flex list-none flex-col gap-2 p-0">
        {items.map((t) => (
          <li key={t} className="flex gap-[10px] text-[14px] leading-[1.5]">
            <span aria-hidden="true" className="text-gold">
              ✓
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {source ? (
        <div className="mt-[14px] rounded-[2px] bg-surface-2 px-[14px] py-3 text-[13px] leading-[1.5]">
          <b>{source.name}</b> · {source.used}
          <br />
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-link font-bold">
            Open the original guidance <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : null}
      <div className="mt-[18px] flex flex-wrap gap-[10px]">
        <Link href="/contact" className="btn btn-primary btn-sm">
          Ask the desk about this
        </Link>
        <Link href="/quote/mission" className="btn btn-secondary btn-sm">
          Request a quote
        </Link>
      </div>
    </WindowButton>
  );
}
