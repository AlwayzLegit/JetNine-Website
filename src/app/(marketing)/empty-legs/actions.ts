"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emptyLegWatchlists, type NewEmptyLegWatchlist } from "@/db/schema/empty-legs";
import { getCurrentUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateWatchlistInput } from "@/lib/watchlist-validation";

export type WatchlistResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Per-IP ceiling. A person creates one or two watchlists; the August 2026
// bot created ~15 a day from rotating addresses, so the limit is a
// backstop — the validation in src/lib/watchlist-validation.ts is the
// primary defence.
const WATCHLIST_RATE_LIMIT_MAX = 3;
const WATCHLIST_RATE_LIMIT_WINDOW_SECONDS = 600;

export async function createWatchlist(formData: FormData): Promise<WatchlistResult> {
  const field = (k: string) => (formData.get(k) as string | null)?.trim() ?? "";

  // Honeypot: the visible form never exposes this field, so any value here
  // is an autofill bot. Pretend success so the bot moves on; insert nothing.
  if (field("company")) {
    console.warn("createWatchlist honeypot tripped — dropping submission");
    return { ok: true, message: "WATCHLIST CREATED" };
  }

  const parsed = validateWatchlistInput({
    from: field("from"),
    to: field("to"),
    earliest: field("earliest"),
    latest: field("latest"),
    mobile: field("mobile"),
    email: field("email"),
  });
  if (!parsed.ok) {
    return { ok: false, error: parsed.errors.join(", ").toUpperCase() };
  }
  const v = parsed.value;
  const from = v.fromText;
  const to = v.toText;
  const earliest = v.earliestOn;
  const latest = v.latestOn;

  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // headers() can throw outside a request scope; proceed without limiting.
  }
  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`watchlist_submit:${clientIp}`, {
      max: WATCHLIST_RATE_LIMIT_MAX,
      windowSeconds: WATCHLIST_RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rl.ok) return { ok: false, error: "RATE_LIMITED" };
  }

  // If the visitor is signed in and has a member profile, link the watchlist
  // so they can manage it from /account/preferences later.
  let memberId: string | null = null;
  let actorUserId: string | null = null;
  let actorRole: string | null = null;
  const user = await getCurrentUser();
  if (user) {
    actorUserId = user.id;
    actorRole = user.role;
    const m = await getMemberByUserId(user.id);
    memberId = m?.id ?? null;
  }

  const values: NewEmptyLegWatchlist = {
    memberId,
    email: v.email,
    phoneE164: v.mobile,
    fromIcao: v.fromIcao,
    fromText: from,
    toIcao: v.toIcao,
    toText: to,
    earliestOn: earliest,
    latestOn: latest,
    minDiscountPct: 30,
    notifyChannels: {
      email: !!v.email,
      sms: true,
    },
    active: true,
  };

  let insertedId: string;
  try {
    const [row] = await db
      .insert(emptyLegWatchlists)
      .values(values)
      .returning({ id: emptyLegWatchlists.id });
    insertedId = row.id;
  } catch (err) {
    console.error("createWatchlist failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }

  // Audit — only when authenticated; anonymous board signups stay
  // out of the audit_log so the table isn't flooded with un-attributable noise.
  if (actorUserId) {
    await logAudit({
      actorUserId,
      actorRole: actorRole ?? undefined,
      action: "empty_leg_watchlist.create",
      subjectType: "empty_leg_watchlist",
      subjectId: insertedId,
      metadata: {
        memberId,
        fromText: from,
        toText: to,
        earliestOn: earliest,
        latestOn: latest,
      },
    });
  }

  revalidatePath("/empty-legs");
  revalidatePath("/account/preferences");
  return {
    ok: true,
    message: `WATCHLIST CREATED — ${from.toUpperCase()} → ${to.toUpperCase()}`,
  };
}
