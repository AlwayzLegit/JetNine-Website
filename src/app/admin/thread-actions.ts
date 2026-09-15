"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { requireStaff } from "@/lib/auth";

/**
 * Mark a thread's inbound messages read. Fired by <MarkThreadRead> when a
 * dispatcher opens the quote workbench / trip sheet — `is_read` was written
 * on every inbound insert but read by nothing until the nav badge landed.
 */
export async function markThreadRead(
  subjectType: "quote" | "trip",
  subjectId: string,
): Promise<{ ok: boolean }> {
  await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(subjectId)) return { ok: false };
  if (subjectType !== "quote" && subjectType !== "trip") return { ok: false };
  await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.subjectType, subjectType),
        eq(messages.subjectId, subjectId),
        eq(messages.direction, "in"),
        eq(messages.isRead, false),
      ),
    );
  return { ok: true };
}
