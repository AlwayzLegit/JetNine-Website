"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactInquiries } from "@/db/schema/contact";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type InquiryActionResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle an inquiry between new ↔ handled. Handled stamps who + when;
 * reopening clears both so the row reads honestly on the board.
 */
export async function setInquiryStatus(formData: FormData): Promise<InquiryActionResult> {
  const user = await requireStaff();

  const id = ((formData.get("id") as string | null) ?? "").trim();
  const status = ((formData.get("status") as string | null) ?? "").trim();
  if (!id) return { ok: false, error: "MISSING_ID" };
  if (status !== "new" && status !== "handled") return { ok: false, error: "BAD_STATUS" };

  try {
    const [row] = await db
      .update(contactInquiries)
      .set(
        status === "handled"
          ? { status: "handled", handledByUserId: user.id, handledAt: new Date() }
          : { status: "new", handledByUserId: null, handledAt: null },
      )
      .where(eq(contactInquiries.id, id))
      .returning({ id: contactInquiries.id });
    if (!row) return { ok: false, error: "NOT_FOUND" };
  } catch (err) {
    console.error("setInquiryStatus failed", err);
    return { ok: false, error: "DB_UPDATE_FAILED" };
  }

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: `contact_inquiry.${status === "handled" ? "handle" : "reopen"}`,
    subjectType: "contact_inquiry",
    subjectId: id,
  });

  revalidatePath("/admin/inquiries");
  return { ok: true };
}
