"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type DeskCounts = {
  /** Requests that need a reply (gold pill). */
  needsReply: number;
  /** Unread inbound messages (outlined pill). */
  unread: number;
};

export const DESK_NAV = [
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/trips", label: "Trips" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export const AVINODE_URL = "https://marketplace.avinode.com/";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Admin shell sidebar from the handoff: 220px, ink-2 background, 40px nav
 * items (current on surface-2), counts as pills, "Open Avinode ↗" under the
 * nav, user + sign-out pinned at the bottom.
 */
export function DeskSidebar({
  counts,
  name,
  roleWord,
  signOutAction,
}: {
  counts: DeskCounts;
  name: string;
  roleWord: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-line-faint bg-ink-2 px-3.5 py-5 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2.5 pb-5 pt-1.5" aria-label="JetNine — Home">
        <Image src="/images/brand/wordmark-bone.webp" alt="" width={1000} height={652} className="h-[30px] w-auto" priority />
        <span className="rounded-[4px] border border-line px-1.5 text-[12px] text-steel">Team</span>
      </Link>
      <nav aria-label="Sections" className="flex flex-col gap-0.5 text-[15px]">
        {DESK_NAV.map((n) => {
          const active = isActive(pathname, n.href);
          const pill =
            n.href === "/admin/requests" && counts.needsReply > 0 ? (
              <span className="pill pill-clearance h-[22px] min-w-[22px] px-[7px] text-[12px] font-semibold !bg-gold">
                {counts.needsReply > 99 ? "99+" : counts.needsReply}
              </span>
            ) : n.href === "/admin/messages" && counts.unread > 0 ? (
              <span className="pill pill-outline h-[22px] min-w-[22px] px-[7px] text-[12px] text-bone">
                {counts.unread > 99 ? "99+" : counts.unread}
              </span>
            ) : null;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex h-10 items-center justify-between rounded-control px-3 transition-colors",
                active ? "bg-surface-2 font-medium text-bone" : "text-bone-2 hover:bg-surface-2/60 hover:text-bone",
              ].join(" ")}
            >
              {n.label}
              {pill}
            </Link>
          );
        })}
      </nav>
      <a
        href={AVINODE_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex h-10 items-center gap-2 rounded-control border border-line px-3 text-[14px] text-bone-2 transition-colors hover:border-steel hover:text-bone"
      >
        Open Avinode <span aria-hidden="true">↗</span>
      </a>
      <div className="mt-auto flex items-center gap-2.5 px-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-clearance">
          {name.trim()[0]?.toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0 text-[14px] leading-[1.3]">
          <div className="truncate text-bone">
            {name} <span className="text-steel">· {roleWord}</span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-steel transition-colors hover:text-bone">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

/**
 * Phone tab bar (Mobile.dc.html, Admin Requests frame): five tabs, 44px
 * targets, Requests count as a small gold badge. The desk is desktop-first;
 * this keeps the five sections reachable on a phone.
 */
export function DeskTabBar({ counts }: { counts: DeskCounts }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line-faint bg-ink-2 px-1 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 text-center text-[12px] lg:hidden"
    >
      {DESK_NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={["relative flex h-11 items-center justify-center", active ? "font-medium text-bone" : "text-steel"].join(" ")}
          >
            {n.label}
            {n.href === "/admin/requests" && counts.needsReply > 0 ? (
              <span className="absolute right-2.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-gold px-1 text-[10px] font-semibold text-ink">
                {counts.needsReply > 99 ? "99+" : counts.needsReply}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone header: wordmark + "Team" tag. */
export function DeskMobileHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-line-faint bg-ink-2 px-5 lg:hidden">
      <Link href="/" className="flex items-center gap-2.5" aria-label="JetNine — Home">
        <Image src="/images/brand/wordmark-bone.webp" alt="" width={1000} height={652} className="h-7 w-auto" />
        <span className="rounded-[4px] border border-line px-1.5 text-[12px] text-steel">Team</span>
      </Link>
      <a href={AVINODE_URL} target="_blank" rel="noreferrer" className="text-[14px] text-bone-2">
        Avinode ↗
      </a>
    </header>
  );
}
