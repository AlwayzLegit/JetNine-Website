"use server";

import { unsubscribeBlogByToken } from "@/lib/blog-subscribe";

export async function blogUnsubscribeAction(formData: FormData): Promise<{ ok: boolean }> {
  const token = ((formData.get("token") as string | null) ?? "").trim();
  return unsubscribeBlogByToken(token);
}
