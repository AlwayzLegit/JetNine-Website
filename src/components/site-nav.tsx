"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";
import { PRIMARY_NAV, SITE } from "@/lib/constants";

// Public-site header from the light handoff (jn-light-chrome.js): a white
// sticky bar with a 1px line under it — wordmark left, six text links,
// then "Request a quote ↗". Below lg the links collapse behind a bordered
// ≡ button into a panel that drops under the bar; the panel also carries
// Sign in and the dispatch line so both stay one tap away on phones.
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the panel when a link lands on a new route.
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

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="container-jn flex min-h-header items-center justify-between gap-6 py-3 max-lg:py-[10px]">
        <BrandMark size="sm" className="lg:hidden" />
        <BrandMark className="max-lg:hidden" />

        <nav className="hidden items-center gap-[30px] whitespace-nowrap text-[14px] lg:flex" aria-label="Primary">
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`transition-colors hover:text-gold ${isActive(href) ? "font-semibold text-bone" : "text-bone"}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/quote/mission" className="btn btn-primary h-[42px] px-[18px] max-lg:h-9 max-lg:px-3 max-lg:text-[12px] max-lg:font-bold">
            Request a quote<span className="max-lg:hidden" aria-hidden="true"> ↗</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Menu"}
            className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-white text-[18px] leading-none text-bone lg:hidden"
          >
            <span aria-hidden="true">{open ? "×" : "≡"}</span>
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Primary"
        className={`flex-col border-t border-line bg-white lg:hidden ${open ? "flex" : "hidden"}`}
      >
        {PRIMARY_NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`border-b border-line px-4 py-3 text-[15px] text-bone ${isActive(href) ? "font-bold" : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        {/* /account is auth-guarded: signed-out lands on /sign-in?next=/account,
            signed-in goes straight to the portal — one link serves both. */}
        <Link href="/account" className="border-b border-line px-4 py-3 text-[15px] text-bone">
          Sign in
        </Link>
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="flex items-center gap-3 px-4 py-3 text-[15px] text-bone">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          Call dispatch · {SITE.dispatchPhone}
        </a>
      </nav>
    </header>
  );
}
