"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";

export type ThreadSubjectType = "quote" | "trip" | "member";

/**
 * Mark a thread's inbound messages read. Fired by <MarkThreadRead> when a
 * dispatcher opens a request, a trip or a conversation in Messages —
 * `is_read` is written on every inbound insert and read by the sidebar
 * count and the Unread tab.
 */
export async function markThreadRead(
  subjectType: ThreadSubjectType,
  subjectId: string,
): Promise<{ ok: boolean }> {
  await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(subjectId)) return { ok: false };
  if (subjectType !== "quote" && subjectType !== "trip" && subjectType !== "member") {
    return { ok: false };
  }
  const updated = await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.subjectType, subjectType),
        eq(messages.subjectId, subjectId),
        eq(messages.direction, "in"),
        eq(messages.isRead, false),
      ),
    )
    .returning({ id: messages.id });
  // Only refresh the desk when something changed, so opening a thread
  // that was already read does not re-render the list.
  if (updated.length > 0) {
    revalidatePath("/admin/messages");
    revalidatePath("/admin", "layout");
  }
  return { ok: true };
}
