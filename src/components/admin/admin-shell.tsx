import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { signOut } from "@/app/(auth)/sign-in/actions";
import type { CurrentUser } from "@/lib/auth";

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

export function AdminShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-3 bg-[rgba(7,8,10,0.92)] backdrop-blur-[14px]">
        <div className="container-jn flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <BrandMark size="sm" />
            <span className="rounded-[2px] border border-ink-3 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-clearance">
              Dispatch desk
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
              {(user.firstName || user.email.split("@")[0]).toUpperCase()} ·{" "}
              <span className="text-clearance">{user.role.toUpperCase()}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
              >
                Sign out →
              </button>
            </form>
          </div>
        </div>
        <nav className="container-jn flex flex-wrap gap-x-6 gap-y-2 border-t border-ink-3 py-3">
          {ADMIN_NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
