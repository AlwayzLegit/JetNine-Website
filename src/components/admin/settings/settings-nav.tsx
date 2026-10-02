"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SETTINGS_NAV = [
  { href: "/admin/settings/reports", label: "Reports", ownerOnly: true },
  { href: "/admin/settings/team", label: "Team", ownerOnly: true },
  { href: "/admin/settings/notifications", label: "Notifications", ownerOnly: false },
  { href: "/admin/settings/connections", label: "Connections", ownerOnly: true },
  { href: "/admin/settings/api-keys", label: "API keys", ownerOnly: true },
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
 * with the current one on surface-2. Owner-only items are hidden from Team
 * users (the pages themselves still gate with requireAdmin).
 */
export function SettingsNav({ owner }: { owner: boolean }) {
  const pathname = usePathname();
  const items = SETTINGS_NAV.filter((i) => owner || !i.ownerOnly);
  return (
    <nav
      aria-label="Settings"
      className="-mx-5 flex gap-0.5 overflow-x-auto px-5 text-[15px] md:mx-0 md:px-0 lg:sticky lg:top-8 lg:flex-col lg:overflow-visible"
    >
      {items.map((i) => {
        const active = isActive(pathname, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex h-10 flex-none items-center whitespace-nowrap rounded-control px-3 transition-colors",
              active ? "bg-surface-2 font-medium text-bone" : "text-bone-2 hover:bg-surface-2/60 hover:text-bone",
            ].join(" ")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
