"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberPreferences, type NewMemberPreferences } from "@/db/schema/member-prefs";
import {
  aircraftCategoryEnum,
  cateringTierEnum,
  groundTypeEnum,
} from "@/db/schema/enums";
import { getCurrentUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { logAudit } from "@/lib/audit";

const CAT = aircraftCategoryEnum.enumValues as readonly string[];
const CAT_TIER = cateringTierEnum.enumValues as readonly string[];
const GROUND = groundTypeEnum.enumValues as readonly string[];

function pickBool(form: FormData, name: string): boolean {
  // checkbox absent = unchecked
  return form.get(name) === "on";
}

function pickInt(form: FormData, name: string, fallback: number, min: number, max: number): number {
  const raw = (form.get(name) as string | null)?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function pickTime(form: FormData, name: string): string | null {
  const raw = (form.get(name) as string | null)?.trim();
  if (!raw) return null;
  // HH:MM expected
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return null;
  return raw.length === 5 ? `${raw}:00` : raw;
}

function pickEnum(form: FormData, name: string, allowed: readonly string[]): string | null {
  const raw = (form.get(name) as string | null)?.trim();
  if (!raw) return null;
  return allowed.includes(raw) ? raw : null;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePreferences(formData: FormData): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const member = await getMemberByUserId(user.id);
  if (!member) return { ok: false, error: "No member profile yet — dispatch will create one." };

  const cat = pickEnum(formData, "defaultAircraftCategory", CAT);
  const catering = pickEnum(formData, "cateringTier", CAT_TIER) ?? "standard";
  const ground = pickEnum(formData, "groundType", GROUND) ?? "sedan";

  const values: NewMemberPreferences = {
    memberId: member.id,
    defaultAircraftCategory: cat as NewMemberPreferences["defaultAircraftCategory"],

    cabinWifi: pickBool(formData, "cabinWifi"),
    cabinStandup: pickBool(formData, "cabinStandup"),
    cabinLavatoryEnclosed: pickBool(formData, "cabinLavatoryEnclosed"),
    cabinLieflat: pickBool(formData, "cabinLieflat"),
    cabinFlightAttendant: pickBool(formData, "cabinFlightAttendant"),
    cabinPetFriendly: pickBool(formData, "cabinPetFriendly"),
    lieflatMinHours: pickInt(formData, "lieflatMinHours", 5, 0, 24),

    cateringTier: catering as NewMemberPreferences["cateringTier"],
    dietary: (formData.get("dietary") as string | null) || null,
    barPreferences: (formData.get("barPreferences") as string | null) || null,
    standingCateringNotes: (formData.get("standingCateringNotes") as string | null) || null,

    groundType: ground as NewMemberPreferences["groundType"],
    groundVendor: (formData.get("groundVendor") as string | null) || null,
    arrivalWindowMinutes: pickInt(formData, "arrivalWindowMinutes", 15, 5, 60),

    commsVoice: pickBool(formData, "commsVoice"),
    commsEmail: pickBool(formData, "commsEmail"),
    commsSmsUpdates: pickBool(formData, "commsSmsUpdates"),
    commsSmsEmptyLeg: pickBool(formData, "commsSmsEmptyLeg"),
    quietHoursStart: pickTime(formData, "quietHoursStart"),
    quietHoursEnd: pickTime(formData, "quietHoursEnd"),
    quietHoursTz: (formData.get("quietHoursTz") as string | null) || null,

    emptyLegAlertThresholdPct: pickInt(formData, "emptyLegAlertThresholdPct", 40, 0, 80),

    anonymizeManifest: pickBool(formData, "anonymizeManifest"),
    blockFlightTracking: pickBool(formData, "blockFlightTracking"),
  };

  // Upsert by primary key (memberId).
  const [existing] = await db
    .select({ memberId: memberPreferences.memberId })
    .from(memberPreferences)
    .where(eq(memberPreferences.memberId, member.id));

  if (existing) {
    await db
      .update(memberPreferences)
      .set(values)
      .where(eq(memberPreferences.memberId, member.id));
  } else {
    await db.insert(memberPreferences).values(values);
  }

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: existing ? "preferences.update" : "preferences.create",
    subjectType: "preferences",
    subjectId: member.id,
    metadata: {
      memberCode: member.memberCode,
      cateringTier: values.cateringTier,
      groundType: values.groundType,
      anonymizeManifest: values.anonymizeManifest,
      blockFlightTracking: values.blockFlightTracking,
    },
  });

  revalidatePath("/account/preferences");
  return { ok: true };
}
