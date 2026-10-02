"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { quotes } from "@/db/schema/quotes";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendDispatchAlert } from "@/lib/email";
import { recipientsFor } from "@/lib/desk-settings";
import { STATUS_TOKEN_RE, statusPath } from "@/lib/request-status";

export type ChooseResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * The client picks one of the options dispatch sent. Keyed by the status
 * token (possession of the link is the proof, as it is for reading the
 * page): the option is marked chosen + accepted, the quote moves to
 * `accepted`, and the desk gets an alert to confirm the booking.
 */
export async function chooseOption(token: string, optionId: string): Promise<ChooseResult> {
  if (!STATUS_TOKEN_RE.test(token) || !UUID_RE.test(optionId)) {
    return { ok: false, error: "BAD_REQUEST" };
  }

  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // outside a request scope (tests)
  }
  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`request_choose:${clientIp}`, { max: 20, windowSeconds: 300 });
    if (!rl.ok) return { ok: false, error: "RATE_LIMITED" };
  }

  const [q] = await db
    .select({
      id: quotes.id,
      code: quotes.quoteCode,
      status: quotes.status,
      contactSnapshot: quotes.contactSnapshot,
    })
    .from(quotes)
    .where(eq(quotes.statusToken, token))
    .limit(1);
  if (!q) return { ok: false, error: "NOT_FOUND" };
  if (q.status !== "options_sent" && q.status !== "held") {
    return { ok: false, error: "NOT_OPEN" };
  }

  const [opt] = await db
    .select({
      id: sourcedOptions.id,
      status: sourcedOptions.status,
      aircraftType: sourcedOptions.aircraftType,
      clientPriceUsd: sourcedOptions.clientPriceUsd,
    })
    .from(sourcedOptions)
    .where(and(eq(sourcedOptions.id, optionId), eq(sourcedOptions.quoteId, q.id)))
    .limit(1);
  if (!opt || opt.status !== "sent_to_client" || opt.clientPriceUsd == null) {
    return { ok: false, error: "OPTION_NOT_AVAILABLE" };
  }

  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  // Claim the quote first, conditionally on it still being open: two
  // holders of the link choosing at once can both pass the read above,
  // but only one UPDATE … WHERE status IN (open) will match a row. The
  // loser sees NOT_OPEN and the page refreshes to the winner's choice.
  const now = new Date();
  let claimed = false;
  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(quotes)
        .set({ status: "accepted", acceptedAt: now, updatedAt: now })
        .where(and(eq(quotes.id, q.id), inArray(quotes.status, ["options_sent", "held"])))
        .returning({ id: quotes.id });
      if (rows.length === 0) return;
      claimed = true;
      await tx
        .update(sourcedOptions)
        .set({ isChosen: false, updatedAt: now })
        .where(eq(sourcedOptions.quoteId, q.id));
      await tx
        .update(sourcedOptions)
        .set({ isChosen: true, status: "accepted", updatedAt: now })
        .where(eq(sourcedOptions.id, opt.id));
    });
  } catch (err) {
    console.error("chooseOption failed", err);
    return { ok: false, error: "DB_UPDATE_FAILED" };
  }
  if (!claimed) return { ok: false, error: "NOT_OPEN" };

  await logAudit({
    actorUserId: user?.id ?? null,
    actorRole: user?.role ?? "client",
    action: "quote.option.client_choose",
    subjectType: "quote",
    subjectId: q.id,
    subjectCode: q.code,
    metadata: { optionId: opt.id, aircraftType: opt.aircraftType, clientPriceUsd: opt.clientPriceUsd },
  });

  const name =
    `${q.contactSnapshot?.firstName ?? ""} ${q.contactSnapshot?.lastName ?? ""}`.trim() || "The client";
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  try {
    await sendDispatchAlert({
      subject: `[CHOSEN] ${q.code} · ${name} picked ${opt.aircraftType ?? "an option"}`,
      headline: `${name} chose an aircraft.`,
      lines: [
        `They picked an option on their request page.`,
        `Option: ${opt.aircraftType ?? "aircraft"} at ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(opt.clientPriceUsd)}.`,
        `Confirm with the operator, then confirm the booking so it becomes a trip.`,
      ],
      link: { label: "Open the request", url: `${base}/admin/requests/${q.id}` },
      // Staff who turned on "A client picks an option"; empty → shared inbox.
      to: await recipientsFor("clientPick"),
    });
  } catch (err) {
    console.error("chooseOption dispatch alert failed", err);
  }

  revalidatePath(statusPath(token));
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${q.id}`);
  return { ok: true };
}
