"use server";

import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { voiceRoutingOp } from "@/domain/settings/ops";

// Settings › Voice agent. The work is the settings.voiceRouting op
// (src/domain/settings), shared with the approval queue; runOp checks the
// `settings` permission (owners) and revalidates the page.

export type VoiceActionResult = { ok: true; changed: boolean } | { ok: false; error: string };

export async function saveVoiceRouting(formData: FormData): Promise<VoiceActionResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const numbers = formData
    .getAll("number")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const r = await runOp(voiceRoutingOp, session.value, {
    ringFirst: formData.get("ringFirst") === "on",
    numbers,
    rings: Number(formData.get("rings")),
    schedule: "always",
    screen: formData.get("screen") === "on",
  });
  if (!r.ok) {
    // The schema's messages are whole sentences ("Add a number to ring first…").
    const first = (r.details as { message?: string }[] | undefined)?.[0]?.message;
    return { ok: false, error: r.code === "invalid" && first ? first : r.error };
  }
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };
  return { ok: true, changed: (r.value.value as { changed: boolean }).changed };
}
