"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DeskCounts = {
  /** Requests that need a reply (gold pill). */
  needsReply: number;
  /** Unread inbound messages (outlined pill). */
  unread: number;
  /** Proposals from the assistant waiting for a decision (gold pill on Messages). */
  approvals: number;
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

const cap = (n: number) => (n > 99 ? "99+" : String(n));

/** Serif letter-spaced wordmark + bronze "Client desk" label (jn-admin-shell). */
function DeskWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="JetNine — Home" className={compact ? "flex items-baseline gap-3" : "block px-2.5"}>
      <span className="font-serif text-[18px] font-normal tracking-[0.27em] text-bone">JETNINE</span>
      <span
        className={`${compact ? "" : "mt-1 block"} text-[12px] font-bold uppercase tracking-[0.2em] text-gold`}
      >
        Client desk
      </span>
    </Link>
  );
}

/**
 * Light admin shell sidebar (jn-admin-shell.js): 210px white column with a
 * hairline right border, serif wordmark, five sections (current one filled
 * navy), count pills in bronze, "Open Avinode ↗" panel under the nav, and the
 * signed-in person + sign-out pinned to the bottom.
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
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface px-3.5 py-[18px] lg:flex">
      <DeskWordmark />
      <nav aria-label="Admin" className="mt-5 flex flex-col gap-0.5 text-[14px]">
        {DESK_NAV.map((n) => {
          const active = isActive(pathname, n.href);
          // Requests: needs a reply. Messages: approvals first, then unread.
          const gold =
            n.href === "/admin/requests"
              ? counts.needsReply
              : n.href === "/admin/messages"
                ? counts.approvals
                : 0;
          const outlined = n.href === "/admin/messages" && !gold ? counts.unread : 0;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center justify-between rounded-control px-2.5 py-[9px] transition-colors",
                active ? "bg-clearance font-bold text-white" : "text-bone hover:bg-surface-2/70",
              ].join(" ")}
            >
              <span>{n.label}</span>
              {gold > 0 ? (
                <span
                  className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-pill px-1.5 text-[12px] font-bold ${
                    active ? "bg-white text-bone" : "bg-gold text-white"
                  }`}
                >
                  {cap(gold)}
                </span>
              ) : outlined > 0 ? (
                <span
                  className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-pill border px-1.5 text-[12px] font-bold ${
                    active ? "border-white text-white" : "border-gold text-gold"
                  }`}
                >
                  {cap(outlined)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <a
        href={AVINODE_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-[18px] flex items-center justify-between border border-line bg-panel px-3 py-2.5 text-[13px] text-bone transition-colors hover:border-gold hover:text-gold"
      >
        <span>Open Avinode</span>
        <span aria-hidden="true">↗</span>
      </a>
      <div className="mt-auto px-2.5 text-[13px] text-steel">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#ECE3D6] font-serif text-[14px] text-gold">
            {name.trim()[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 leading-[1.35]">
            <div className="truncate font-bold text-bone">{name}</div>
            <div className="text-[12px]">{roleWord}</div>
          </div>
        </div>
        <form action={signOutAction} className="mt-2.5">
          <button type="submit" className="whitespace-nowrap text-steel transition-colors hover:text-bone">
            Sign out →
          </button>
        </form>
      </div>
    </aside>
  );
}

/**
 * Phone tab bar: five tabs, 44px targets, Requests / Messages counts as a
 * small bronze badge, current tab in navy bold with a bronze top rule. The
 * desk is desktop-first; this keeps the five sections reachable on a phone.
 */
export function DeskTabBar({ counts }: { counts: DeskCounts }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line bg-surface px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1 text-center text-[12px] lg:hidden"
    >
      {DESK_NAV.map((n) => {
        const active = isActive(pathname, n.href);
        const badge =
          n.href === "/admin/requests" ? counts.needsReply : n.href === "/admin/messages" ? counts.approvals : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex h-11 items-center justify-center border-t-2",
              active ? "border-gold font-bold text-bone" : "border-transparent text-steel",
            ].join(" ")}
          >
            {n.label}
            {badge > 0 ? (
              <span className="absolute right-1.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-gold px-1 text-[10px] font-bold text-white">
                {cap(badge)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone header: serif wordmark + "Client desk", Avinode link. */
export function DeskMobileHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
      <DeskWordmark compact />
      <a
        href={AVINODE_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-[13px] text-bone"
      >
        Avinode ↗
      </a>
    </header>
  );
}
