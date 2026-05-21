"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { emptyLegWatchlists, type NewEmptyLegWatchlist } from "@/db/schema/empty-legs";

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

  const values: NewEmptyLegWatchlist = {
    memberId: null,
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

  try {
    await db.insert(emptyLegWatchlists).values(values);
  } catch (err) {
    console.error("createWatchlist failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }

  revalidatePath("/empty-legs");
  return {
    ok: true,
    message: `WATCHLIST CREATED — ${(from || "").toUpperCase()} → ${(to || "").toUpperCase()}`,
  };
}
