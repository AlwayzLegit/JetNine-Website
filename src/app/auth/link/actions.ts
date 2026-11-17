"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { consumeToken } from "@/lib/auth-tokens";
import { createSession } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { isPurpose } from "@/lib/auth-tokens/core.mjs";

// Guessing a 256-bit token is not a risk, but every POST costs a database
// write, so the same two-window shape as the other sign-in actions applies.
const IP_MAX = 10;
const IP_WINDOW_S = 600;
const GLOBAL_MAX = 300;
const GLOBAL_WINDOW_S = 3600;

async function clientIp(): Promise<string> {
  try {
    return clientIpFrom(await headers()) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * The button on /auth/link. Spends the one-time token (one atomic UPDATE),
 * starts the site's own session and sends the person on: to `next` for a
 * sign-in link, to the set-password page for a reset or an invite. A token
 * that is spent, expired or wrong lands on /auth/link?expired=1, the same
 * page for every failure.
 */
export async function spendEmailLink(formData: FormData): Promise<void> {
  const token = String(formData.get("t") ?? "");
  const purpose = String(formData.get("p") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || null);

  const ip = await clientIp();
  if (ip !== "unknown") {
    const rl = await checkRateLimit(`authlink:${ip}`, { max: IP_MAX, windowSeconds: IP_WINDOW_S });
    if (!rl.ok) redirect("/auth/link?expired=1");
  }
  const globalRl = await checkRateLimit("authlink:global", { max: GLOBAL_MAX, windowSeconds: GLOBAL_WINDOW_S });
  if (!globalRl.ok) redirect("/auth/link?expired=1");

  const userId = isPurpose(purpose) ? await consumeToken(token, purpose) : null;
  if (!userId) redirect("/auth/link?expired=1");

  try {
    await createSession(userId);
  } catch (err) {
    const e = err as { name?: string; code?: string };
    console.error("[auth-link] createSession failed", { name: e?.name, code: e?.code });
    redirect("/sign-in?error=session_unavailable");
  }

  redirect(purpose === "signin" ? next : "/auth/reset");
}
