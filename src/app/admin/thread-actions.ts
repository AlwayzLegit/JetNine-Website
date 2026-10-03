"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/domain/actor";
import { markThreadReadOp } from "@/domain/messages/ops";
import { runOp } from "@/domain/ops/registry";

export type ThreadSubjectType = "quote" | "trip" | "member";

/**
 * Mark a thread's inbound messages read. Fired by <MarkThreadRead> when a
 * dispatcher opens a request, a trip or a conversation in Messages —
 * `is_read` is written on every inbound insert and read by the sidebar
 * count and the Unread tab. The work itself is the "message.markRead" op
 * (src/domain/messages), shared with the API; runOp revalidates the
 * Messages page when something changed.
 */
export async function markThreadRead(
  subjectType: ThreadSubjectType,
  subjectId: string,
): Promise<{ ok: boolean }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false };
  if (!/^[0-9a-f-]{36}$/i.test(subjectId)) return { ok: false };
  if (subjectType !== "quote" && subjectType !== "trip" && subjectType !== "member") {
    return { ok: false };
  }
  const r = await runOp(markThreadReadOp, session.value, { kind: subjectType, id: subjectId });
  if (!r.ok || r.value.kind === "pending") return { ok: false };
  // The sidebar's unread count lives in the admin layout, which only a
  // layout revalidation refreshes; the op cannot express that, so it stays
  // here. Only when something changed, so an already-read thread does not
  // re-render the desk.
  if ((r.value.value as { updated: number }).updated > 0) revalidatePath("/admin", "layout");
  return { ok: true };
}
