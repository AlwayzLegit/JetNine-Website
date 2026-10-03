"use server";

import { revalidatePath } from "next/cache";
import { sessionActor } from "@/domain/actor";
import { dismissItem } from "@/domain/agent/commands";

// "Assistant notes" on a request or trip page. A person dismisses one of
// the assistant's notes; the domain decides who may, this only refreshes
// the page it was dismissed from.

export type DismissResult = { ok: true } | { ok: false; error: string };

export async function dismissAssistantItem(id: string, path: string): Promise<DismissResult> {
  const s = await sessionActor();
  if (!s.ok) return { ok: false, error: s.error };

  const r = await dismissItem(s.value, id);
  if (!r.ok) return { ok: false, error: r.error };

  // Only a desk page may be refreshed from here.
  if (typeof path === "string" && path.startsWith("/admin/")) revalidatePath(path);
  return { ok: true };
}
