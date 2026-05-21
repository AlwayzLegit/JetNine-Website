"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import {
  emptyLegs,
  emptyLegStatusEnum,
  type NewEmptyLeg,
} from "@/db/schema/empty-legs";
import { requireStaff } from "@/lib/auth";

export type CreateEmptyLegResult =
  | { ok: true; code: string; id: string }
  | { ok: false; error: string };

export async function createEmptyLeg(formData: FormData): Promise<CreateEmptyLegResult> {
  const user = await requireStaff();

  const tail = ((formData.get("aircraftTail") as string | null) ?? "").trim().toUpperCase();
  const fromIcao = ((formData.get("fromIcao") as string | null) ?? "").trim().toUpperCase();
  const fromIata = ((formData.get("fromIata") as string | null) ?? "").trim().toUpperCase();
  const fromCity = (formData.get("fromCity") as string | null)?.trim() ?? null;
  const toIcao = ((formData.get("toIcao") as string | null) ?? "").trim().toUpperCase();
  const toIata = ((formData.get("toIata") as string | null) ?? "").trim().toUpperCase();
  const toCity = (formData.get("toCity") as string | null)?.trim() ?? null;

  if (!tail) return { ok: false, error: "Aircraft tail required" };
  if (!fromIcao || !toIcao) return { ok: false, error: "ICAO codes required" };

  const wheelsUpAtRaw = (formData.get("wheelsUpAt") as string | null)?.trim();
  if (!wheelsUpAtRaw) return { ok: false, error: "Wheels-up time required" };
  const wheelsUpAt = new Date(wheelsUpAtRaw);
  if (Number.isNaN(wheelsUpAt.getTime())) return { ok: false, error: "Invalid wheels-up date" };

  const seats = Number(formData.get("seats") ?? 0);
  const fullCharter = Number(formData.get("fullCharterRefUsd") ?? 0);
  const listed = Number(formData.get("listedPriceUsd") ?? 0);

  if (seats < 1 || seats > 19) return { ok: false, error: "Seats 1–19" };
  if (fullCharter < 1000) return { ok: false, error: "Full charter ref looks too low" };
  if (listed < 500) return { ok: false, error: "Listed price looks too low" };
  if (listed >= fullCharter) return { ok: false, error: "Listed must be less than full charter" };

  const discountPct = Math.round(((fullCharter - listed) / fullCharter) * 100);
  if (discountPct < 5) {
    return { ok: false, error: "Discount under 5% — operator margin floor blocks publish." };
  }

  // Look up the aircraft + operator + category by tail.
  const [ac] = await db
    .select({
      id: aircraft.id,
      operatorId: aircraft.operatorId,
      category: aircraft.category,
    })
    .from(aircraft)
    .where(eq(aircraft.tailNumber, tail));
  if (!ac) return { ok: false, error: `Unknown tail ${tail}` };

  const statusRaw = (formData.get("status") as string | null) ?? "draft";
  const status = (emptyLegStatusEnum.enumValues as readonly string[]).includes(statusRaw)
    ? (statusRaw as NewEmptyLeg["status"])
    : "draft";

  const flightMinutes = Number(formData.get("flightMinutes") ?? 0) || null;
  const distanceNm = Number(formData.get("distanceNm") ?? 0) || null;
  const minDiscountPct = Math.max(0, Math.min(80, Number(formData.get("minDiscountPct") ?? 30)));

  const values: NewEmptyLeg = {
    aircraftId: ac.id,
    operatorId: ac.operatorId,
    category: ac.category,
    fromIcao,
    fromIata: fromIata || null,
    fromCity,
    toIcao,
    toIata: toIata || null,
    toCity,
    wheelsUpAt,
    flightMinutes,
    distanceNm,
    seatsAvailable: seats,
    fullCharterRefUsd: fullCharter,
    listedPriceUsd: listed,
    discountPct,
    autoPriceDecay: formData.get("autoPriceDecay") === "on",
    minDiscountPct,
    reserveLockMinutes: 30,
    petFriendly: formData.get("petFriendly") === "on",
    headline: (formData.get("headline") as string | null) || null,
    bodyCopy: (formData.get("bodyCopy") as string | null) || null,
    visibilityFlags: {
      publicBoard: formData.get("visPublic") === "on",
      memberMatch: formData.get("visMemberMatch") === "on",
      weeklyDigest: formData.get("visWeekly") === "on",
      affiliateFeed: false,
    },
    status,
    createdByUserId: user.id,
    boardGoLiveAt: status === "live" ? new Date() : null,
    expiresAt: wheelsUpAt,
  };

  try {
    const [row] = await db
      .insert(emptyLegs)
      .values(values)
      .returning({ id: emptyLegs.id, code: emptyLegs.code });
    revalidatePath("/admin/empty-leg");
    revalidatePath("/empty-legs");
    return { ok: true, id: row.id, code: row.code };
  } catch (err) {
    console.error("createEmptyLeg failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}
