"use server";

import { redirect } from "next/navigation";
import { sessionActor } from "@/domain/actor";
import { runOp } from "@/domain/ops/registry";
import { testEmailOp } from "@/domain/settings/ops";

// Settings › Connections › Email › "Send a test". Owner-only (the
// `settings` permission). The work itself is the settings.testEmail op
// (src/domain/settings), shared with the API: it emails the signed-in
// owner through the same layer the desk uses for clients. This wrapper
// then comes back to the page with ?test=sent|failed so the row can say so.

export async function sendTestEmail(): Promise<void> {
  const session = await sessionActor();
  if (!session.ok) return;

  const r = await runOp(testEmailOp, session.value, {});
  if (!r.ok) redirect("/admin/settings/connections?test=failed");
  if (r.value.kind === "pending") return;
  const result = r.value.value as { ok: boolean; provider: string | null };
  redirect(`/admin/settings/connections?test=${result.ok ? `sent&provider=${result.provider}` : "failed"}`);
}
