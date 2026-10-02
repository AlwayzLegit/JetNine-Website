"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const ACCOUNT_NAV = [
  { href: "/account", label: "Overview", desc: "Everything at a glance" },
  { href: "/account/quotes", label: "Quotes", desc: "Submitted & in progress" },
  { href: "/account/trips", label: "Trips", desc: "Past, upcoming, in-flight" },
  { href: "/account/invoices", label: "Invoices", desc: "Outstanding & paid" },
  { href: "/account/members", label: "Membership", desc: "Tier, balance, activity" },
  { href: "/account/memberships", label: "Buy / top up", desc: "Card checkout & reserve top-up" },
  { href: "/account/preferences", label: "Preferences", desc: "Cabin, catering, ground" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/account" ? pathname === "/account" : pathname.startsWith(href);
}

type Props = {
  name: string;
  email: string;
  /** Server action bound by the layout; rendered as a form so it works without JS. */
  signOutAction: () => Promise<void>;
  /** Dispatch desk link for staff accounts. */
  staff?: boolean;
};

/**
 * Member account left rail from the handoff: label, name, email, seven
 * items with 13px descriptions (current one on surface-2), primary
 * "Request a quote →", "Sign out →". Sticky under the header on desktop.
 */
export function AccountRail({ name, email, signOutAction, staff }: Props) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Account"
      className="sticky top-[calc(var(--header-h)+24px)] hidden flex-col gap-0.5 text-[15px] lg:flex"
    >
      <div className="px-3 pb-4">
        <div className="label-jn text-[13px]">Member account</div>
        <div className="mt-1 text-[17px] font-medium text-bone">{name}</div>
        <div className="truncate text-[14px] text-steel" title={email}>
          {email}
        </div>
      </div>
      {ACCOUNT_NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex flex-col rounded-control px-3 py-2.5 transition-colors",
              active ? "bg-surface-2 text-bone" : "text-bone-2 hover:bg-surface-2/60 hover:text-bone",
            ].join(" ")}
          >
            <span className="font-medium">{n.label}</span>
            <span className="text-[13px] text-steel">{n.desc}</span>
          </Link>
        );
      })}
      {staff ? (
        <Link
          href="/admin/requests"
          className="mt-1 flex flex-col rounded-control px-3 py-2.5 text-bone-2 transition-colors hover:bg-surface-2/60 hover:text-bone"
        >
          <span className="font-medium">Dispatch desk</span>
          <span className="text-[13px] text-steel">Staff only</span>
        </Link>
      ) : null}
      <Link href="/quote/mission" className="btn btn-primary mt-3 w-full">
        Request a quote <span aria-hidden="true">→</span>
      </Link>
      <form action={signOutAction} className="mt-3">
        <button
          type="submit"
          className="flex min-h-[44px] w-full items-center px-3 text-left text-[14px] text-steel transition-colors hover:text-bone"
        >
          Sign out →
        </button>
      </form>
    </nav>
  );
}

/**
 * Phone tab bar (Mobile.dc.html, Account frame): Overview · Trips ·
 * Quote · More, 44px targets, pinned to the bottom. "More" opens the
 * remaining sections as a sheet.
 */
export function AccountTabBar({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const tabs = [
    { href: "/account", label: "Overview" },
    { href: "/account/trips", label: "Trips" },
    { href: "/quote/mission", label: "Quote" },
  ];
  const moreItems = ACCOUNT_NAV.filter((n) => !["/account", "/account/trips"].includes(n.href));
  const moreActive = moreItems.some((n) => isActive(pathname, n.href));
  return (
    <>
      {more ? (
        <div className="fixed inset-0 z-40 bg-ink lg:hidden" role="dialog" aria-label="More account sections">
          <div className="container-jn flex h-full flex-col py-6">
            <div className="flex items-center justify-between">
              <span className="label-jn text-[13px]">Account</span>
              <button
                type="button"
                onClick={() => setMore(false)}
                className="flex h-11 w-11 items-center justify-center rounded-pill border border-line-2 text-bone"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 flex flex-col">
              {moreItems.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMore(false)}
                  className="flex min-h-[52px] flex-col justify-center border-b border-line-faint"
                >
                  <span className="text-[18px] font-medium text-bone">{n.label}</span>
                  <span className="text-[13px] text-steel">{n.desc}</span>
                </Link>
              ))}
            </div>
            <form action={signOutAction} className="mt-auto">
              <button type="submit" className="btn btn-secondary w-full">
                Sign out →
              </button>
            </form>
          </div>
        </div>
      ) : null}
      <nav
        aria-label="Account"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-line-faint bg-ink-2 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 text-center text-[12px] lg:hidden"
      >
        {tabs.map((t) => {
          const active = t.href.startsWith("/account") && isActive(pathname, t.href) && !moreActive;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={["flex h-11 items-center justify-center", active ? "font-medium text-bone" : "text-steel"].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className={["flex h-11 items-center justify-center", more || moreActive ? "font-medium text-bone" : "text-steel"].join(" ")}
        >
          More
        </button>
      </nav>
    </>
  );
}
