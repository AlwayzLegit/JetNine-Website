"use server";

import { revalidatePath } from "next/cache";
import { postQuoteMessage } from "@/app/admin/requests/[id]/actions";
import { postTripMessage } from "@/app/admin/trips/[id]/actions";

export type PostThreadMessageResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Composer on the Messages page. Delegates to the existing request / trip
 * post actions (which carry the auth check, delivery and audit) and then
 * refreshes the Messages list. Member threads have no post action yet, so
 * the page shows that composer disabled and this returns an error if hit.
 */
export async function postThreadMessage(
  subjectType: "quote" | "trip" | "member",
  subjectId: string,
  formData: FormData,
): Promise<PostThreadMessageResult> {
  let result: PostThreadMessageResult;
  if (subjectType === "quote") {
    result = await postQuoteMessage(subjectId, formData);
  } else if (subjectType === "trip") {
    result = await postTripMessage(subjectId, formData);
  } else {
    return { ok: false, error: "Reply from the client's request or trip" };
  }
  if (result.ok) revalidatePath("/admin/messages");
  return result;
}
