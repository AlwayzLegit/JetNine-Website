"use server";

import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { socialLinksOp } from "@/domain/settings/ops";
import { SOCIAL_PLATFORMS } from "@/lib/social-links";

// Settings › Social links. The work is the settings.socialLinks op
// (src/domain/settings), shared with the approval queue; runOp checks the
// `settings` permission (owners), revalidates the page and clears the
// footer's cache on every public page.

export type SocialActionResult = { ok: true; changed: boolean } | { ok: false; error: string };

export async function saveSocialLinks(formData: FormData): Promise<SocialActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const input: Record<string, string> = {};
  for (const p of SOCIAL_PLATFORMS) input[p] = String(formData.get(p) ?? "");

  const r = await runOp(socialLinksOp, session.value, input);
  if (!r.ok) {
    // The schema's messages name the platform ("Instagram: …").
    const first = (r.details as { message?: string }[] | undefined)?.[0]?.message;
    return { ok: false, error: r.code === "invalid" && first ? first : r.error };
  }
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, changed: (r.value.value as { changed: boolean }).changed };
}
