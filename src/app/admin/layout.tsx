import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  // Unread inbound count for the nav badge (is_read + its index existed
  // since the messages table landed; nothing read them until now). Opening
  // a quote/trip sheet marks that thread read via <MarkThreadRead>.
  let unreadInbox = 0;
  try {
    const [row] = await db
      .select({ n: count() })
      .from(messages)
      .where(and(eq(messages.direction, "in"), eq(messages.isRead, false)));
    unreadInbox = row?.n ?? 0;
  } catch {
    // Badge is a convenience — never block the desk on it.
  }

  return (
    <AdminShell user={user} unreadInbox={unreadInbox}>
      {children}
    </AdminShell>
  );
}
