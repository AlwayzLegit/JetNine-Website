"use server";

import { sessionActor } from "@/domain/actor";
import { inquiryStatusOp } from "@/domain/messages/ops";
import { runOp } from "@/domain/ops/registry";

export type InquiryActionResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle an inquiry between new ↔ handled. The work itself is the
 * "inquiry.status" op (src/domain/messages), shared with the API; runOp
 * revalidates the Messages page.
 */
export async function setInquiryStatus(formData: FormData): Promise<InquiryActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const id = ((formData.get("id") as string | null) ?? "").trim();
  const status = ((formData.get("status") as string | null) ?? "").trim();
  if (!id) return { ok: false, error: "MISSING_ID" };
  if (status !== "new" && status !== "handled") return { ok: false, error: "BAD_STATUS" };

  const r = await runOp(inquiryStatusOp, session.value, { id, status });
  // The status is checked above, so a schema failure can only be the id.
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "NOT_FOUND" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true };
}
