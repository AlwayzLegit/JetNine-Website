"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ADMIN_NAV = [
  { href: "/admin/dispatch", label: "Inbox" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/quote", label: "Workbench" },
  { href: "/admin/ops", label: "Live ops" },
  { href: "/admin/trip", label: "Trips" },
  { href: "/admin/member", label: "Members" },
  { href: "/admin/operators", label: "Operators" },
  { href: "/admin/aircraft", label: "Aircraft" },
  { href: "/admin/airports", label: "Airports" },
  { href: "/admin/empty-leg", label: "Empty legs" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/health", label: "Health" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Collapse the mobile disclosure once a link lands on a new route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const linkCls = (href: string) =>
    [
      "font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
      isActive(href) ? "text-bone" : "text-bone-2 hover:text-bone",
    ].join(" ");

  const current = ADMIN_NAV.find((l) => isActive(l.href));

  return (
    <nav className="border-t border-ink-3" aria-label="Admin sections">
      {/* Desktop: full wrapped row */}
      <div className="container-jn hidden flex-wrap gap-x-6 gap-y-2 py-3 lg:flex">
        {ADMIN_NAV.map((l) => (
          <Link key={l.href} href={l.href} className={linkCls(l.href)}>
            {l.label}
          </Link>
        ))}
      </div>

      {/* Mobile: disclosure that shows the current section + expands to all */}
      <div className="container-jn lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-nav-list"
          className="flex min-h-[44px] w-full items-center justify-between gap-3 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
        >
          <span>
            <span className="text-steel">Section · </span>
            <span className="text-bone">{current?.label ?? "Menu"}</span>
          </span>
          <span aria-hidden="true">{open ? "▲" : "▼"}</span>
        </button>
        {open ? (
          <div id="admin-nav-list" className="flex flex-col pb-2">
            {ADMIN_NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-h-[44px] items-center border-t border-ink-3 py-3 ${linkCls(l.href)}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
