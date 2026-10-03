import { requireStaff } from "@/lib/auth";
import { deskCounts } from "@/domain/desk/queries";
import { AdminShell } from "@/components/admin/admin-shell";
import type { DeskCounts } from "@/components/admin/desk-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  // Sidebar pills: requests that need a reply (gold) and unread inbound
  // messages (outlined). Both are conveniences — never block the desk on them.
  let counts: DeskCounts = { needsReply: 0, unread: 0 };
  try {
    counts = await deskCounts();
  } catch {
    // Badge is a convenience — never block the desk on it.
  }

  return (
    <AdminShell user={user} counts={counts}>
      {children}
    </AdminShell>
  );
}
