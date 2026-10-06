"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "@/lib/constants";

export const ACCOUNT_NAV = [
  { href: "/account", label: "Overview", desc: "Everything at a glance" },
  { href: "/account/trips", label: "Trips", desc: "Past, upcoming, in-flight" },
  { href: "/account/quotes", label: "Quotes", desc: "Submitted & in progress" },
  { href: "/account/invoices", label: "Invoices", desc: "Outstanding & paid" },
  { href: "/account/members", label: "Membership", desc: "Tier, balance, activity" },
  { href: "/account/memberships", label: "Buy / top up", desc: "Card checkout & reserve top-up" },
  { href: "/account/preferences", label: "Preferences", desc: "Cabin, catering, ground" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/account" ? pathname === "/account" : pathname === href || pathname.startsWith(`${href}/`);
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
 * Member account left rail (Light - Account): "My account" eyebrow, serif
 * name, email, the sections with a 2px bronze bar on the current one,
 * the dispatch contact block and "Sign out →". Sticky on desktop. Below
 * lg the same rail stacks above the content, with the sections as a
 * wrapping row of chips so nothing scrolls sideways.
 */
export function AccountRail({ name, email, signOutAction, staff }: Props) {
  const pathname = usePathname();
  const items = [
    ...ACCOUNT_NAV,
    ...(staff ? [{ href: "/admin/requests", label: "Dispatch desk", desc: "Staff only" }] : []),
  ];
  return (
    <nav
      aria-label="Account"
      className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:border-r lg:border-line lg:pr-3.5"
    >
      <p className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">My account</p>
      <div className="mt-1.5 font-serif text-[20px] leading-[1.2] text-bone">{name}</div>
      <div className="truncate text-[12px] text-steel" title={email}>
        {email}
      </div>

      {/* Desktop: vertical list with the bronze bar */}
      <div className="mt-3.5 hidden flex-col gap-0.5 lg:flex">
        {items.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              title={n.desc}
              className={[
                "-ml-0.5 flex items-center justify-between border-l-2 px-2.5 py-2 text-[14px] text-bone transition-colors",
                active ? "border-gold bg-surface-2 font-bold" : "border-transparent hover:bg-surface-2/60",
              ].join(" ")}
            >
              {n.label}
            </Link>
          );
        })}
      </div>

      {/* Phones and tablets: wrapping chips */}
      <div className="mt-3.5 flex flex-wrap gap-2 lg:hidden">
        {items.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={["chip", active ? "is-selected" : ""].join(" ")}
            >
              {n.label}
            </Link>
          );
        })}
      </div>

      <hr className="my-4 border-0 border-t border-line max-lg:hidden" />
      <div className="max-lg:hidden">
        <div className="text-[12px] text-steel">Your dispatcher</div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-2 font-serif text-gold">
            J
          </span>
          <div>
            <div className="text-[14px] font-bold text-bone">JetNine dispatch</div>
            <div className="text-[12px] text-success">Answers 24/7</div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="flex h-[34px] items-center justify-center border border-line bg-surface text-[13px] text-bone transition-colors hover:text-gold"
          >
            Call
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="flex h-[34px] items-center justify-center border border-line bg-surface text-[13px] text-bone transition-colors hover:text-gold"
          >
            Email
          </a>
        </div>
      </div>
      <form action={signOutAction} className="mt-[18px] max-lg:mt-3">
        <button
          type="submit"
          className="flex min-h-[28px] items-center whitespace-nowrap text-[13px] text-steel transition-colors hover:text-gold"
        >
          Sign out →
        </button>
      </form>
    </nav>
  );
}
