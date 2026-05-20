"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";

const PRIMARY_LINKS = [
  { href: "/aircraft", label: "Aircraft" },
  { href: "/memberships", label: "Memberships" },
  { href: "/empty-legs", label: "Empty legs" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 h-20 transition-all duration-300 ease-out-quint",
        scrolled
          ? "border-b border-ink-3 bg-[rgba(7,8,10,0.92)] backdrop-blur-[14px]"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="container-jn flex h-full items-center justify-between">
        <BrandMark />

        <nav className="hidden lg:flex gap-8" aria-label="Primary">
          {PRIMARY_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                  active ? "text-bone" : "text-bone-2 hover:text-bone",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="tel:+18889999999"
            className="hidden lg:inline-block font-mono text-[12px] text-bone-2 transition-colors hover:text-bone"
          >
            +1 888 999 9999
          </a>
          <Link href="/quote" className="btn btn-primary btn-sm">
            Request a quote <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
