import { requireStaff } from "@/lib/auth";
import { deskRole } from "@/lib/desk-status";
import { DeskPage } from "@/components/admin/desk-ui";
import { SettingsNav } from "@/components/admin/settings/settings-nav";

export const dynamic = "force-dynamic";

/**
 * Settings (Phase 5): `200px minmax(0,1fr)` with the sticky secondary nav
 * on the left. Owner-only items (Reports, Team, Connections, History) are
 * hidden from Team users here and gated again by each page.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const owner = deskRole(user.role) === "owner";
  return (
    <DeskPage>
      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <SettingsNav owner={owner} />
        <div className="min-w-0">{children}</div>
      </div>
    </DeskPage>
  );
}
