"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SETTINGS_NAV = [
  { href: "/admin/settings/reports", label: "Reports", ownerOnly: true },
  { href: "/admin/settings/team", label: "Team", ownerOnly: true },
  { href: "/admin/settings/notifications", label: "Notifications", ownerOnly: false },
  { href: "/admin/settings/connections", label: "Connections", ownerOnly: true },
  { href: "/admin/settings/api-keys", label: "API keys", ownerOnly: true },
  { href: "/admin/settings/assistant", label: "Assistant", ownerOnly: true },
  { href: "/admin/settings/history", label: "History", ownerOnly: true },
  { href: "/admin/settings/reference", label: "Reference data", ownerOnly: false },
] as const;

/** The AI providers page sits under Connections in the nav. */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(href + "/")) return true;
  return href === "/admin/settings/connections" && pathname.startsWith("/admin/settings/ai");
}

/**
 * Secondary nav for Settings: 200px column, sticky on desktop, 40px items
 * with the current one on sand behind a 2px bronze bar (light prototype). Owner-only items are hidden from Team
 * users (the pages themselves still gate with requireAdmin).
 */
export function SettingsNav({ owner }: { owner: boolean }) {
  const pathname = usePathname();
  const items = SETTINGS_NAV.filter((i) => owner || !i.ownerOnly);
  return (
    <nav
      aria-label="Settings"
      className="-mx-4 flex gap-0.5 overflow-x-auto border-b border-line px-4 text-[14px] md:mx-0 md:px-0 lg:sticky lg:top-5 lg:flex-col lg:overflow-visible lg:border-b-0"
    >
      {items.map((i) => {
        const active = isActive(pathname, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-h-11 flex-none items-center whitespace-nowrap border-b-2 px-2.5 py-2 text-bone transition-colors lg:-ml-0.5 lg:min-h-0 lg:border-b-0 lg:border-l-2",
              active ? "border-gold bg-surface-2 font-bold" : "border-transparent hover:bg-surface-2/50",
            ].join(" ")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
