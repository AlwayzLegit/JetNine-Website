"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type TocItem = { label: string; href: string };

/**
 * "On this page" rail from the guide boards. Sticky under the header;
 * the current section gets the bronze left rule (scroll-spy). Plain
 * anchors, so it works before hydration too.
 *
 * - "rail":  muted links with a 2px bronze inset rule (Broker / Fees).
 * - "boxed": paper box with numbered links and a sand highlight
 *            (Beginner's guide); `quick` adds a second link group.
 * - "ruled": right-ruled column (How to book).
 */
export function TocNav({
  items,
  variant = "rail",
  title = "On this page",
  numbered = false,
  extra,
  className = "",
}: {
  items: (TocItem & { n?: string })[];
  variant?: "rail" | "boxed" | "ruled";
  title?: string;
  numbered?: boolean;
  extra?: { title: string; links: TocItem[] };
  className?: string;
}) {
  const [active, setActive] = useState(items[0]?.href ?? "");

  useEffect(() => {
    const els = items
      .map((i) => document.getElementById(i.href.replace(/^#/, "")))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(`#${visible[0].target.id}`);
      },
      { rootMargin: "-90px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  const shell =
    variant === "boxed"
      ? "border border-line bg-[#FBFAF7] px-3 py-[14px]"
      : variant === "ruled"
        ? "border-r border-line pr-[14px] max-md:border-r-0 max-md:pr-0"
        : "";

  return (
    <nav aria-label={title} className={`sticky top-[calc(var(--header-h)+16px)] flex flex-col gap-[2px] text-[13px] ${shell} ${className}`}>
      {variant === "rail" ? (
        <span className="mb-[6px] text-steel">{title}</span>
      ) : (
        <p className="mb-[10px] text-[12px] font-semibold uppercase tracking-[.16em] text-gold">{title}</p>
      )}
      {items.map((t) => {
        const on = active === t.href;
        if (variant === "rail") {
          return (
            <a
              key={t.href}
              href={t.href}
              aria-current={on ? "location" : undefined}
              className={`px-3 py-[5px] ${on ? "text-bone shadow-[inset_2px_0_0_var(--gold)]" : "text-steel hover:text-bone"}`}
            >
              {t.label}
            </a>
          );
        }
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={on ? "location" : undefined}
            className={[
              "flex gap-[10px] px-[10px] text-bone",
              variant === "boxed" ? "-ml-[2px] border-l-2 py-2 text-[14px]" : "py-[7px] text-[13px]",
              variant === "boxed" ? (on ? "border-gold bg-surface-2 font-semibold" : "border-transparent") : on ? "font-semibold text-gold" : "",
            ].join(" ")}
          >
            {numbered && t.n ? <span className={`pt-[2px] text-[12px] ${variant === "boxed" ? "font-semibold text-gold" : ""}`}>{t.n}</span> : null}
            <span>{t.label}</span>
          </a>
        );
      })}
      {extra ? (
        <>
          <hr className="my-[22px] border-0 border-t border-line" />
          <p className="mb-[10px] text-[12px] font-semibold uppercase tracking-[.16em] text-gold">{extra.title}</p>
          {extra.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="block px-[10px] py-[7px] text-[14px] text-bone hover:text-gold">
              {l.label} <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </>
      ) : null}
    </nav>
  );
}
