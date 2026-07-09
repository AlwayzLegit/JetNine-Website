"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";
import { PRIMARY_NAV, SITE } from "@/lib/constants";

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile panel when a link lands on a new route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock background scroll while the full-screen mobile panel is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const linkClass = (href: string) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return [
      "font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
      active ? "text-bone" : "text-bone-2 hover:text-bone",
    ].join(" ");
  };

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-out-quint",
        // Open mobile panel must be fully opaque — links over a translucent
        // header bleed page text through on top of hero imagery.
        open
          ? "border-b border-ink-3 bg-ink"
          : scrolled
            ? "border-b border-ink-3 bg-[rgba(7,8,10,0.92)] backdrop-blur-[14px]"
            : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="container-jn flex h-20 items-center justify-between">
        <BrandMark />

        <nav className="hidden lg:flex gap-8" aria-label="Primary">
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="hidden lg:inline-block font-mono text-[12px] text-bone-2 transition-colors hover:text-bone"
          >
            {SITE.dispatchPhone}
          </a>
          <Link href="/quote/mission" className="btn btn-primary btn-sm">
            Request quote <span className="arrow">→</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-[2px] border border-ink-4 text-bone-2 transition-colors hover:border-bone-2 hover:text-bone lg:hidden"
          >
            <span
              aria-hidden="true"
              className={[
                "h-px w-4 bg-current transition-transform duration-200 ease-out-quint",
                open ? "translate-y-[3px] rotate-45" : "",
              ].join(" ")}
            />
            <span
              aria-hidden="true"
              className={[
                "h-px w-4 bg-current transition-transform duration-200 ease-out-quint",
                open ? "-translate-y-[3px] -rotate-45" : "",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      {/* Full-height opaque overlay below the header bar — covers the hero so
          page text never bleeds through, and scrolls if the list is long. */}
      <nav
        id="mobile-nav"
        aria-label="Primary"
        className={[
          "lg:hidden fixed inset-x-0 top-20 bottom-0 z-40 overflow-y-auto bg-ink",
          open ? "block" : "hidden",
        ].join(" ")}
      >
        <div className="container-jn flex flex-col py-3">
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`${linkClass(href)} border-b border-ink-3 py-5 last:border-b-0`}
            >
              {label}
            </Link>
          ))}
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="mt-2 flex min-h-[44px] items-center gap-3 py-5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-clearance opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-clearance" />
            </span>
            Dispatch open · {SITE.dispatchPhone}
          </a>
        </div>
      </nav>
    </header>
  );
}
