"use server";

import { unsubscribeByToken, type UnsubscribeScope } from "@/lib/watchlist-unsubscribe";

export async function unsubscribeAction(
  formData: FormData,
): Promise<{ ok: boolean; scope: UnsubscribeScope }> {
  const token = (formData.get("token") as string | null)?.trim() ?? "";
  const scope: UnsubscribeScope = formData.get("scope") === "all" ? "all" : "email";
  const result = await unsubscribeByToken(token, scope);
  return { ok: result.ok, scope };
}
