"use server";

import { sessionActor } from "@/domain/actor";
import { messageRetryOp } from "@/domain/messages/ops";
import type { MessageRetryOutcome } from "@/domain/messages/commands";
import { runOp } from "@/domain/ops/registry";

export type RetryResult =
  | { ok: true; status: "sent" | "failed"; provider?: string; error?: string }
  | { ok: false; error: string };

/**
 * Retry a failed thread-message delivery. The work itself is the
 * "message.retry" op (src/domain/messages), shared with the API and the
 * approval queue; runOp revalidates the Messages page and the thread's
 * request or trip. The error codes (NOT_FOUND, NOT_FAILED …) are what the
 * failed-delivery list already matches on.
 */
export async function retryMessageDelivery(messageId: string): Promise<RetryResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return { ok: false, error: "INVALID_ID" };
  }

  const r = await runOp(messageRetryOp, session.value, { id: messageId });
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "INVALID_ID" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: "This was sent for approval." };

  const outcome = r.value.value as MessageRetryOutcome;
  return outcome.status === "sent"
    ? { ok: true, status: "sent", provider: outcome.provider }
    : { ok: true, status: "failed", error: outcome.error };
}
