"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emptyLegWatchlists, type NewEmptyLegWatchlist } from "@/db/schema/empty-legs";
import { getCurrentUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { logAudit } from "@/lib/audit";

export type WatchlistResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function createWatchlist(formData: FormData): Promise<WatchlistResult> {
  const from = (formData.get("from") as string | null)?.trim();
  const to = (formData.get("to") as string | null)?.trim();
  const earliest = (formData.get("earliest") as string | null)?.trim();
  const latest = (formData.get("latest") as string | null)?.trim();
  const mobile = (formData.get("mobile") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim();

  // Validation
  const errors: string[] = [];
  if (!from) errors.push("departing");
  if (!to) errors.push("arriving");
  if (!earliest) errors.push("earliest");
  if (!latest) errors.push("latest");
  if (!mobile) errors.push("mobile");
  if (mobile && !/^\+?[\d\s().-]{7,}$/.test(mobile)) errors.push("mobile-format");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email-format");

  if (errors.length) {
    return { ok: false, error: errors.join(", ").toUpperCase() };
  }

  // ICAO heuristic: 4 uppercase letters means we treat the field as a code.
  const isIcao = (s?: string | null) => !!s && /^[A-Z]{4}$/.test(s.toUpperCase());

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
    email: email || null,
    phoneE164: mobile,
    fromIcao: isIcao(from) ? from!.toUpperCase() : null,
    fromText: from!,
    toIcao: isIcao(to) ? to!.toUpperCase() : null,
    toText: to!,
    earliestOn: earliest!,
    latestOn: latest!,
    minDiscountPct: 30,
    notifyChannels: {
      email: !!email,
      sms: !!mobile,
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
    message: `WATCHLIST CREATED — ${(from || "").toUpperCase()} → ${(to || "").toUpperCase()}`,
  };
}
