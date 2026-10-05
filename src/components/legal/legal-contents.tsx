"use client";

import { useEffect, useState } from "react";

export type LegalDoc = {
  numeral: string;
  title: string;
  items: readonly (readonly [string, string, string])[];
};

/**
 * "In this section" box from Light - Legal: a topic filter, then one
 * collapsible group per document listing its numbered sections. The
 * section currently in view gets the bronze bar. Every row is a real
 * anchor, so the list works without JavaScript and deep links
 * (/legal#agreement, #sms …) keep working.
 */
export function LegalContents({ docs }: { docs: readonly LegalDoc[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const [active, setActive] = useState<string | null>(null);

  // Track the section nearest the top of the viewport.
  useEffect(() => {
    const ids = docs.flatMap((d) => d.items.map((i) => i[2].slice(1)));
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const onScroll = () => {
      let cur: string | null = null;
      for (const el of els) {
        if (el.getBoundingClientRect().top < 160) cur = el.id;
      }
      setActive(cur ?? els[0].id);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [docs]);

  // Open the group that holds the active section (or the hash target).
  useEffect(() => {
    if (!active) return;
    const di = docs.findIndex((d) => d.items.some((i) => i[2] === `#${active}`));
    if (di >= 0) setOpen((o) => (o[di] ? o : { ...o, [di]: true }));
  }, [active, docs]);

  const ql = q.trim().toLowerCase();
  const filtered = docs.map((d) => ({
    ...d,
    items: d.items.filter((i) => !ql || i[1].toLowerCase().includes(ql) || d.title.toLowerCase().includes(ql)),
  }));
  const matches = filtered.reduce((n, d) => n + d.items.length, 0);

  return (
    <div className="border border-line bg-white p-[18px]">
      <h2 className="font-serif text-[21px] font-normal leading-[1.2]">In this section</h2>
      <label className="mt-[10px] flex h-[38px] items-center gap-2 border border-line bg-white px-[10px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--steel)" strokeWidth="1.6" aria-hidden="true" className="h-4 w-4 flex-none">
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4-4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a topic"
          aria-label="Find a topic"
          className="w-full min-w-0 border-0 bg-transparent text-[14px] text-bone outline-none placeholder:text-steel-dim"
        />
      </label>
      {ql ? (
        <div className="mt-2 flex items-center justify-between text-[12px] text-steel" role="status">
          <span>
            {matches} matching topic{matches === 1 ? "" : "s"}
          </span>
          <button type="button" onClick={() => setQ("")} className="border-0 bg-transparent p-0 text-[12px] text-bone underline underline-offset-[3px]">
            Clear search
          </button>
        </div>
      ) : null}
      <div className="mt-[10px] flex flex-col">
        {filtered.map((d, di) => {
          if (ql && !d.items.length) return null;
          const isOpen = Boolean(open[di]) || Boolean(ql);
          return (
            <div key={d.title} className="border-t border-line">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [di]: !o[di] }))}
                className="flex w-full items-center gap-2 border-0 bg-transparent px-1 py-[10px] text-left font-serif text-[17px] text-bone"
              >
                <span className="w-[26px] flex-none text-[13px]">{d.numeral}</span>
                <span className="min-w-0 flex-1">{d.title}</span>
                <span aria-hidden="true" className="flex-none text-[12px] text-steel">
                  {isOpen ? "⌄" : "›"}
                </span>
              </button>
              {/* Collapsed groups stay in the HTML (hidden) so every anchor
                  is crawlable and reachable without JavaScript. */}
              <ol hidden={!isOpen} className={`${isOpen ? "flex" : "hidden"} flex-col gap-[2px] pb-[10px]`}>
                  {d.items.map(([n, label, href]) => {
                    const on = active === href.slice(1);
                    return (
                      <li key={n}>
                        <a
                          href={href}
                          aria-current={on ? "location" : undefined}
                          className={[
                            "grid min-h-[36px] grid-cols-[30px_minmax(0,1fr)] items-center gap-[10px] border-l-[3px] px-[10px] py-2 text-[13px] text-bone hover:text-gold",
                            on ? "border-gold bg-[#F7EFE4] font-bold" : "border-transparent",
                          ].join(" ")}
                        >
                          <span>{n}</span>
                          <span>{label}</span>
                        </a>
                      </li>
                    );
                  })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const COPY_ICON = "M9 9h10v12H9zM5 15H4V3h10v1";

/** Print + copy-link actions above the documents. */
export function LegalTools() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <>
      <div className="flex gap-[18px] text-[14px] print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-[6px] border-0 bg-transparent p-0 text-[14px] text-bone hover:text-gold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-4 w-4">
            <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
          </svg>
          Print
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).catch(() => {});
            setCopied(true);
          }}
          className="inline-flex items-center gap-[6px] border-0 bg-transparent p-0 text-[14px] text-bone hover:text-gold"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-4 w-4">
            <path d={COPY_ICON} />
          </svg>
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
      {copied ? <CopiedToast onClose={() => setCopied(false)} /> : null}
    </>
  );
}

/** Small icon button beside each section title: copies /legal#<id>. */
export function CopySectionLink({ id, label }: { id: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <>
      <button
        type="button"
        aria-label={`Copy link to ${label}`}
        title="Copy section link"
        onClick={() => {
          const url = `${window.location.href.split("#")[0]}#${id}`;
          navigator.clipboard?.writeText(url).catch(() => {});
          setCopied(true);
        }}
        className="ml-auto flex h-8 w-8 flex-none items-center justify-center border-0 bg-transparent text-steel hover:text-gold print:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-4 w-4">
          <path d={COPY_ICON} />
        </svg>
      </button>
      {copied ? <CopiedToast onClose={() => setCopied(false)} /> : null}
    </>
  );
}

function CopiedToast({ onClose }: { onClose: () => void }) {
  return (
    <div role="status" className="fixed bottom-6 right-6 z-[900] flex items-center gap-[14px] bg-navy px-4 py-3 text-[14px] text-white shadow-[0_10px_30px_rgba(18,35,46,0.3)] max-sm:left-4 max-sm:right-4">
      <span>Link copied ✓</span>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="border-0 bg-transparent text-[18px] leading-none text-white">
        ×
      </button>
    </div>
  );
}
