"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companions,
  memberLanes,
  memberPreferences,
  type NewCompanion,
  type NewMemberLane,
  type NewMemberPreferences,
} from "@/db/schema/member-prefs";
import {
  aircraftCategoryEnum,
  cateringTierEnum,
  companionRelationEnum,
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

// ─── Companions ─────────────────────────────────────────────────────────────

const RELATION = companionRelationEnum.enumValues as readonly string[];

export type CompanionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function addCompanion(formData: FormData): Promise<CompanionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const member = await getMemberByUserId(user.id);
  if (!member) return { ok: false, error: "No member profile yet." };

  const relation = pickEnum(formData, "relation", RELATION);
  if (!relation) return { ok: false, error: "Relation required" };

  const legalName = ((formData.get("legalName") as string | null) ?? "").trim();
  if (legalName.length < 2) return { ok: false, error: "Legal name required" };
  if (legalName.length > 120) return { ok: false, error: "Legal name too long" };

  const birthRaw = ((formData.get("birthDate") as string | null) ?? "").trim();
  let birthDate: string | null = null;
  if (birthRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthRaw)) return { ok: false, error: "Birth date YYYY-MM-DD" };
    birthDate = birthRaw;
  }

  const isPet = relation === "pet";
  const speciesBreed = isPet
    ? ((formData.get("speciesBreed") as string | null) ?? "").trim() || null
    : null;
  const weightRaw = isPet ? ((formData.get("weightLb") as string | null) ?? "").trim() : "";
  let weightLb: number | null = null;
  if (weightRaw) {
    const n = parseInt(weightRaw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 250) weightLb = n;
  }

  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const ccOnItinerary = pickBool(formData, "ccOnItinerary");

  const values: NewCompanion = {
    memberId: member.id,
    relation: relation as NewCompanion["relation"],
    legalName,
    birthDate,
    speciesBreed,
    weightLb,
    notes,
    ccOnItinerary,
  };

  try {
    const [row] = await db
      .insert(companions)
      .values(values)
      .returning({ id: companions.id });

    await logAudit({
      actorUserId: user.id,
      actorRole: user.role,
      action: "companion.create",
      subjectType: "member",
      subjectId: member.id,
      subjectCode: member.memberCode,
      metadata: {
        companionId: row.id,
        relation,
        legalName,
        ccOnItinerary,
      },
    });

    revalidatePath("/account/preferences");
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("addCompanion failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function deleteCompanion(companionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const member = await getMemberByUserId(user.id);
  if (!member) return { ok: false, error: "No member profile yet." };

  if (!/^[0-9a-f-]{36}$/i.test(companionId)) return { ok: false, error: "Bad id" };

  const [target] = await db
    .select({ id: companions.id, legalName: companions.legalName, relation: companions.relation })
    .from(companions)
    .where(and(eq(companions.id, companionId), eq(companions.memberId, member.id)));
  if (!target) return { ok: false, error: "Not found" };

  await db.delete(companions).where(eq(companions.id, target.id));

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "companion.delete",
    subjectType: "member",
    subjectId: member.id,
    subjectCode: member.memberCode,
    metadata: {
      companionId: target.id,
      legalName: target.legalName,
      relation: target.relation,
    },
  });

  revalidatePath("/account/preferences");
  return { ok: true };
}

// ─── Lanes ──────────────────────────────────────────────────────────────────

export type LaneResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function addLane(formData: FormData): Promise<LaneResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const member = await getMemberByUserId(user.id);
  if (!member) return { ok: false, error: "No member profile yet." };

  const fromIcao = ((formData.get("fromIcao") as string | null) ?? "").trim().toUpperCase();
  const toIcao = ((formData.get("toIcao") as string | null) ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(fromIcao)) return { ok: false, error: "From ICAO invalid" };
  if (!/^[A-Z0-9]{3,4}$/.test(toIcao)) return { ok: false, error: "To ICAO invalid" };
  if (fromIcao === toIcao) return { ok: false, error: "From and To must differ" };

  const freqRaw = ((formData.get("frequencyPerYear") as string | null) ?? "").trim();
  let frequencyPerYear: number | null = null;
  if (freqRaw) {
    const n = parseInt(freqRaw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 365) frequencyPerYear = n;
  }
  const seasonal = pickBool(formData, "seasonal");

  // Conflict check — member_lanes_unique covers this but a clean error is nicer.
  const [conflict] = await db
    .select({ id: memberLanes.id })
    .from(memberLanes)
    .where(
      and(
        eq(memberLanes.memberId, member.id),
        eq(memberLanes.fromIcao, fromIcao),
        eq(memberLanes.toIcao, toIcao),
      ),
    );
  if (conflict) return { ok: false, error: "Lane already on file" };

  const values: NewMemberLane = {
    memberId: member.id,
    fromIcao,
    toIcao,
    frequencyPerYear,
    seasonal,
  };

  try {
    const [row] = await db
      .insert(memberLanes)
      .values(values)
      .returning({ id: memberLanes.id });

    await logAudit({
      actorUserId: user.id,
      actorRole: user.role,
      action: "lane.create",
      subjectType: "member",
      subjectId: member.id,
      subjectCode: member.memberCode,
      metadata: {
        laneId: row.id,
        route: `${fromIcao}→${toIcao}`,
        frequencyPerYear,
        seasonal,
      },
    });

    revalidatePath("/account/preferences");
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("addLane failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function deleteLane(laneId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const member = await getMemberByUserId(user.id);
  if (!member) return { ok: false, error: "No member profile yet." };

  if (!/^[0-9a-f-]{36}$/i.test(laneId)) return { ok: false, error: "Bad id" };

  const [target] = await db
    .select({ id: memberLanes.id, fromIcao: memberLanes.fromIcao, toIcao: memberLanes.toIcao })
    .from(memberLanes)
    .where(and(eq(memberLanes.id, laneId), eq(memberLanes.memberId, member.id)));
  if (!target) return { ok: false, error: "Not found" };

  await db.delete(memberLanes).where(eq(memberLanes.id, target.id));

  await logAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "lane.delete",
    subjectType: "member",
    subjectId: member.id,
    subjectCode: member.memberCode,
    metadata: {
      laneId: target.id,
      route: `${target.fromIcao}→${target.toIcao}`,
    },
  });

  revalidatePath("/account/preferences");
  return { ok: true };
}
