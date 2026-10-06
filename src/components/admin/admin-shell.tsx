import { signOut } from "@/app/(auth)/sign-in/actions";
import type { CurrentUser } from "@/lib/auth";
import { deskRole, DESK_ROLE_WORDS } from "@/lib/desk-status";
import { DeskMobileHeader, DeskSidebar, DeskTabBar, type DeskCounts } from "@/components/admin/desk-sidebar";

/**
 * Dispatch desk shell (Phase 5): `210px minmax(0,1fr)` grid (light jn-admin-shell) with the
 * sticky sidebar on desktop; wordmark header + five-tab bar on phones.
 * The desk is desktop-first (≥1100px) except the Requests list, which has
 * its own phone layout.
 */
export function AdminShell({
  user,
  children,
  counts,
}: {
  user: CurrentUser;
  children: React.ReactNode;
  counts: DeskCounts;
}) {
  const name = user.firstName || user.email.split("@")[0];
  const role = deskRole(user.role);
  const roleWord = role ? DESK_ROLE_WORDS[role].label : "Staff";
  return (
    <div className="min-h-screen bg-ink text-bone lg:grid lg:grid-cols-[210px_minmax(0,1fr)]">
      <DeskSidebar counts={counts} name={name} roleWord={roleWord} signOutAction={signOut} />
      <DeskMobileHeader />
      <main className="min-w-0 pb-24 lg:pb-0">{children}</main>
      <DeskTabBar counts={counts} />
    </div>
  );
}
