"use server";

import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { notificationPrefOp, replyPromiseOp } from "@/domain/settings/ops";

// Settings › Notifications. The work itself is the settings.* ops
// (src/domain/settings), shared with the API and the approval queue; runOp
// checks the permission and revalidates the pages. The four toggles are per
// user (any staff); the reply-time promise is desk-wide and owner-only
// (the `settings` permission).

export type PrefResult = { ok: true } | { ok: false; error: string };

export async function saveNotificationPref(kind: string, on: boolean): Promise<PrefResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const r = await runOp(notificationPrefOp, session.value, { userId: session.value.userId, kind, on: Boolean(on) });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Unknown setting" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true };
}

export async function saveReplyPromise(formData: FormData): Promise<void> {
  const session = await sessionActor();
  if (!session.ok) return;
  const minutes = Number(formData.get("minutes"));
  // Not one of the choices, no change, or a save that failed: the page
  // stays as it was, as before.
  await runOp(replyPromiseOp, session.value, { minutes });
}
