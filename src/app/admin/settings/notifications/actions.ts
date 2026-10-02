"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getReplyPromiseMinutes,
  isNotificationKind,
  isReplyPromiseChoice,
  saveNotificationPrefs,
  setReplyPromiseMinutes,
} from "@/lib/desk-settings";

// Settings › Notifications. The four toggles are per user (any staff);
// the reply-time promise is desk-wide and owner-only.

const PATH = "/admin/settings/notifications";

export type PrefResult = { ok: true } | { ok: false; error: string };

export async function saveNotificationPref(kind: string, on: boolean): Promise<PrefResult> {
  const user = await requireStaff();
  if (!isNotificationKind(kind)) return { ok: false, error: "Unknown setting" };
  try {
    await saveNotificationPrefs(user.id, { [kind]: Boolean(on) });
  } catch (err) {
    console.error("[settings/notifications] save failed", err);
    return { ok: false, error: "Could not save. Try again." };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function saveReplyPromise(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const minutes = Number(formData.get("minutes"));
  if (!isReplyPromiseChoice(minutes)) return;
  const before = await getReplyPromiseMinutes();
  if (before === minutes) return;
  await setReplyPromiseMinutes(minutes, actor.id);
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "system.reply_promise.update",
    subjectType: "system",
    subjectCode: "reply_promise_minutes",
    diff: { minutes: { before, after: minutes } },
  });
  revalidatePath(PATH);
  revalidatePath("/admin/requests");
}
