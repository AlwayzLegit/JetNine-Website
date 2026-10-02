import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { quotes } from "@/db/schema/quotes";
import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import type { DeskCounts } from "@/components/admin/desk-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  // Sidebar pills: requests that need a reply (gold) and unread inbound
  // messages (outlined). Both are conveniences — never block the desk on them.
  const counts: DeskCounts = { needsReply: 0, unread: 0 };
  try {
    const [[reply], [unread]] = await Promise.all([
      db
        .select({ n: count() })
        .from(quotes)
        .where(inArray(quotes.status, ["submitted"])),
      db
        .select({ n: count() })
        .from(messages)
        .where(and(eq(messages.direction, "in"), eq(messages.isRead, false))),
    ]);
    counts.needsReply = reply?.n ?? 0;
    counts.unread = unread?.n ?? 0;
  } catch {
    // Badge is a convenience — never block the desk on it.
  }

  return (
    <AdminShell user={user} counts={counts}>
      {children}
    </AdminShell>
  );
}
