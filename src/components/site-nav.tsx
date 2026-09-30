"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";
import { PRIMARY_NAV, SITE } from "@/lib/constants";

// Public-site header from the simplification handoff: sticky 72px bar
// (64px on phones), translucent ink with a 14px blur, wordmark left, six
// text links, then Sign in · phone · primary "Request quote →". On phones
// the links collapse behind a 44px ☰ button and the phone becomes a 44px
// round ☏ button so dispatch stays one tap away.
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const linkClass = (href: string) =>
    [
      "text-[15px] leading-none transition-colors",
      isActive(href) ? "font-medium text-bone" : "text-bone-2 hover:text-bone",
    ].join(" ");

  const iconButton =
    "flex h-11 w-11 items-center justify-center rounded-pill border border-line-2 text-bone transition-colors hover:border-steel lg:hidden";

  return (
    <header
      className={[
        "sticky top-0 z-50 border-b border-line-faint",
        // Open mobile panel must be fully opaque — links over a translucent
        // header bleed page text through on top of hero imagery. The blur
        // also has to go while open: backdrop-filter makes the header the
        // containing block for the fixed panel below, which would pin it
        // to the bar instead of the viewport.
        open ? "bg-ink" : "bg-[rgba(7,8,10,0.86)] backdrop-blur-[14px]",
      ].join(" ")}
    >
      <div className="container-jn flex h-header items-center justify-between gap-6">
        {/* 28px mark on phones, 36px from the tablet breakpoint up. */}
        <BrandMark size="sm" className="md:hidden" />
        <BrandMark className="max-md:hidden" />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={linkClass(href)}
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 lg:gap-5">
          {/* /account is auth-guarded: signed-out lands on /sign-in?next=/account,
              signed-in goes straight to the portal — one link serves both. */}
          <Link href="/account" className={`hidden lg:inline-block ${linkClass("/account")}`}>
            Sign in
          </Link>
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="hidden whitespace-nowrap text-[15px] leading-none text-bone-2 transition-colors hover:text-bone lg:inline-block"
          >
            {SITE.dispatchPhone}
          </a>
          <Link href="/quote/mission" className="btn btn-primary max-lg:hidden">
            Request quote <span className="arrow" aria-hidden="true">→</span>
          </Link>

          {/* Phones: dispatch (20-second pick-up) must be one tap away,
              not buried behind the menu. Icon-only to fit the bar. */}
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            aria-label={`Call dispatch, ${SITE.dispatchPhone}`}
            className={iconButton}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className={`${iconButton} flex-col gap-[5px]`}
          >
            <span
              aria-hidden="true"
              className={[
                "h-px w-[18px] bg-current transition-transform duration-200 ease-out-quint",
                open ? "translate-y-[3px] rotate-45" : "",
              ].join(" ")}
            />
            <span
              aria-hidden="true"
              className={[
                "h-px w-[18px] bg-current transition-transform duration-200 ease-out-quint",
                open ? "-translate-y-[3px] -rotate-45" : "",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      {/* Full-height opaque panel below the bar — covers the hero so page
          text never bleeds through, and scrolls if the list is long. The
          primary CTA is pinned at the bottom so it is always reachable. */}
      <nav
        id="mobile-nav"
        aria-label="Primary"
        className={[
          "fixed inset-x-0 bottom-0 top-header z-40 flex-col bg-ink lg:hidden",
          open ? "flex" : "hidden",
        ].join(" ")}
      >
        <div className="container-jn flex flex-1 flex-col overflow-y-auto py-2">
          {PRIMARY_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={[
                "flex min-h-[52px] items-center border-b border-line-faint text-[18px]",
                isActive(href) ? "font-medium text-bone" : "text-bone-2",
              ].join(" ")}
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/account"
            className="flex min-h-[52px] items-center border-b border-line-faint text-[18px] text-bone-2"
          >
            Sign in
          </Link>
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="flex min-h-[52px] items-center gap-3 text-[16px] text-bone-2"
          >
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            Dispatch open · {SITE.dispatchPhone}
          </a>
        </div>
        <div className="container-jn border-t border-line-faint py-4">
          <Link href="/quote/mission" className="btn btn-primary btn-lg w-full">
            Request a quote <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
