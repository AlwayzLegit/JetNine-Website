"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  airports,
  airportCustomsEnum,
  fbos,
  type NewAirport,
  type NewFbo,
} from "@/db/schema/airports";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const ICAO_RE = /^[A-Z0-9]{4}$/;
const IATA_RE = /^[A-Z0-9]{3}$/;
const ISO2_RE = /^[A-Z]{2}$/;
const CUSTOMS = airportCustomsEnum.enumValues as readonly string[];

function pickString(form: FormData, name: string): string {
  return ((form.get(name) as string | null) ?? "").trim();
}

function pickBool(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

function pickInt(form: FormData, name: string): number | null {
  const raw = pickString(form, name);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function pickFloat(form: FormData, name: string): number | null {
  const raw = pickString(form, name);
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

// ─── Airports ──────────────────────────────────────────────────────────────

export type CreateAirportResult =
  | { ok: true; id: string; icao: string }
  | { ok: false; error: string };

export async function createAirport(formData: FormData): Promise<CreateAirportResult> {
  const actor = await requireAdmin();

  const icao = pickString(formData, "icao").toUpperCase();
  if (!ICAO_RE.test(icao)) return { ok: false, error: "ICAO must be 4 chars" };

  const iataRaw = pickString(formData, "iata").toUpperCase();
  if (iataRaw && !IATA_RE.test(iataRaw)) return { ok: false, error: "IATA must be 3 chars" };

  const name = pickString(formData, "name");
  if (name.length < 2) return { ok: false, error: "Name required" };
  if (name.length > 120) return { ok: false, error: "Name too long" };

  const city = pickString(formData, "city");
  if (city.length < 1) return { ok: false, error: "City required" };

  const countryIso2 = pickString(formData, "countryIso2").toUpperCase();
  if (!ISO2_RE.test(countryIso2)) return { ok: false, error: "Country must be ISO-2 (US, GB, ...)" };

  const lat = pickFloat(formData, "lat");
  const lon = pickFloat(formData, "lon");
  if (lat === null || lat < -90 || lat > 90) return { ok: false, error: "Latitude out of range" };
  if (lon === null || lon < -180 || lon > 180) return { ok: false, error: "Longitude out of range" };

  const region = pickString(formData, "region") || null;
  const tz = pickString(formData, "tz") || null;
  const elevationFt = pickInt(formData, "elevationFt");
  const longestRunwayFt = pickInt(formData, "longestRunwayFt");
  const category = pickString(formData, "category") || null;
  const notes = pickString(formData, "notes") || null;

  const customsRaw = pickString(formData, "customs") || "none";
  if (!CUSTOMS.includes(customsRaw)) return { ok: false, error: "Bad customs value" };

  // Conflict check — clean error beats a unique-violation stack trace.
  const [conflict] = await db
    .select({ id: airports.id })
    .from(airports)
    .where(eq(airports.icao, icao));
  if (conflict) return { ok: false, error: `Airport ${icao} already on file` };

  const values: NewAirport = {
    icao,
    iata: iataRaw || null,
    name,
    city,
    region,
    countryIso2,
    lat: String(lat) as unknown as NewAirport["lat"],
    lon: String(lon) as unknown as NewAirport["lon"],
    elevationFt,
    tz,
    category,
    longestRunwayFt,
    customs: customsRaw as NewAirport["customs"],
    slotControlled: pickBool(formData, "slotControlled"),
    privateOnly: pickBool(formData, "privateOnly"),
    active: !pickBool(formData, "inactive"), // default active unless ticked
    notes,
  };

  try {
    const [row] = await db
      .insert(airports)
      .values(values)
      .returning({ id: airports.id, icao: airports.icao });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "airport.create",
      subjectType: "system",
      subjectId: row.id,
      subjectCode: row.icao,
      metadata: { name, city, countryIso2, iata: iataRaw || null },
    });

    revalidatePath("/admin/airports");
    return { ok: true, id: row.id, icao: row.icao };
  } catch (err) {
    console.error("createAirport failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function updateAirport(
  airportId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };

  const [before] = await db
    .select()
    .from(airports)
    .where(eq(airports.id, airportId));
  if (!before) return { ok: false, error: "Not found" };

  // Same validation as create, but ICAO change collisions need the
  // "exclude self" check.
  const icao = pickString(formData, "icao").toUpperCase();
  if (!ICAO_RE.test(icao)) return { ok: false, error: "ICAO must be 4 chars" };

  if (icao !== before.icao) {
    const [conflict] = await db
      .select({ id: airports.id })
      .from(airports)
      .where(and(eq(airports.icao, icao), ne(airports.id, airportId)));
    if (conflict) return { ok: false, error: `Another airport already uses ${icao}` };
  }

  const iataRaw = pickString(formData, "iata").toUpperCase();
  if (iataRaw && !IATA_RE.test(iataRaw)) return { ok: false, error: "IATA must be 3 chars" };

  const name = pickString(formData, "name");
  if (name.length < 2) return { ok: false, error: "Name required" };
  const city = pickString(formData, "city");
  if (city.length < 1) return { ok: false, error: "City required" };

  const countryIso2 = pickString(formData, "countryIso2").toUpperCase();
  if (!ISO2_RE.test(countryIso2)) return { ok: false, error: "Country must be ISO-2" };

  const lat = pickFloat(formData, "lat");
  const lon = pickFloat(formData, "lon");
  if (lat === null || lat < -90 || lat > 90) return { ok: false, error: "Latitude out of range" };
  if (lon === null || lon < -180 || lon > 180) return { ok: false, error: "Longitude out of range" };

  const customsRaw = pickString(formData, "customs") || "none";
  if (!CUSTOMS.includes(customsRaw)) return { ok: false, error: "Bad customs value" };

  const patch: Partial<NewAirport> = {
    icao,
    iata: iataRaw || null,
    name,
    city,
    region: pickString(formData, "region") || null,
    countryIso2,
    lat: String(lat) as unknown as NewAirport["lat"],
    lon: String(lon) as unknown as NewAirport["lon"],
    elevationFt: pickInt(formData, "elevationFt"),
    tz: pickString(formData, "tz") || null,
    category: pickString(formData, "category") || null,
    longestRunwayFt: pickInt(formData, "longestRunwayFt"),
    customs: customsRaw as NewAirport["customs"],
    slotControlled: pickBool(formData, "slotControlled"),
    privateOnly: pickBool(formData, "privateOnly"),
    active: !pickBool(formData, "inactive"),
    notes: pickString(formData, "notes") || null,
  };

  await db.update(airports).set(patch).where(eq(airports.id, airportId));

  // Synthesize a diff against the columns that changed.
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) {
    if ((before as Record<string, unknown>)[k] !== patch[k]) {
      diff[k] = { before: (before as Record<string, unknown>)[k], after: patch[k] };
    }
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "airport.update",
    subjectType: "system",
    subjectId: airportId,
    subjectCode: icao,
    diff: Object.keys(diff).length ? diff : null,
  });

  revalidatePath("/admin/airports");
  revalidatePath(`/admin/airports/${airportId}`);
  return { ok: true };
}

export async function deleteAirport(
  airportId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };

  const [target] = await db
    .select({ id: airports.id, icao: airports.icao, name: airports.name })
    .from(airports)
    .where(eq(airports.id, airportId));
  if (!target) return { ok: false, error: "Not found" };

  // FBOs cascade via FK. Other tables (quote_legs / trip_legs / etc.) hold
  // ICAO as free text today, so deletion is non-blocking on referential
  // integrity. The catalog is reference data — soft-delete (active=false)
  // is usually safer than hard-delete; offered both via the toolbar.
  await db.delete(airports).where(eq(airports.id, airportId));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "airport.delete",
    subjectType: "system",
    subjectId: airportId,
    subjectCode: target.icao,
    metadata: { name: target.name },
  });

  revalidatePath("/admin/airports");
  return { ok: true };
}

// ─── FBOs ───────────────────────────────────────────────────────────────────

const E164_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateFboResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createFbo(
  airportId: string,
  formData: FormData,
): Promise<CreateFboResult> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };

  const [ap] = await db
    .select({ id: airports.id, icao: airports.icao })
    .from(airports)
    .where(eq(airports.id, airportId));
  if (!ap) return { ok: false, error: "Airport not found" };

  const name = pickString(formData, "name");
  if (name.length < 2) return { ok: false, error: "Name required" };
  if (name.length > 120) return { ok: false, error: "Name too long" };

  const phone = pickString(formData, "phoneE164") || null;
  const afterHours = pickString(formData, "afterHoursPhoneE164") || null;
  const email = pickString(formData, "email") || null;
  const website = pickString(formData, "website") || null;

  if (phone && !E164_RE.test(phone)) return { ok: false, error: "Phone must be E.164" };
  if (afterHours && !E164_RE.test(afterHours)) return { ok: false, error: "After-hours phone must be E.164" };
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Email looks invalid" };

  const radioFreqStr = pickString(formData, "radioFreqMhz");

  const values: NewFbo = {
    airportId,
    name,
    isPrimary: pickBool(formData, "isPrimary"),
    isPreferred: pickBool(formData, "isPreferred"),
    radioFreqMhz: radioFreqStr ? (radioFreqStr as unknown as NewFbo["radioFreqMhz"]) : null,
    phoneE164: phone,
    afterHoursPhoneE164: afterHours,
    email,
    website,
    hoursWeekday: pickString(formData, "hoursWeekday") || null,
    hoursWeekend: pickString(formData, "hoursWeekend") || null,
    customs24h: pickBool(formData, "customs24h"),
    notes: pickString(formData, "notes") || null,
  };

  try {
    const [row] = await db
      .insert(fbos)
      .values(values)
      .returning({ id: fbos.id });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "fbo.create",
      subjectType: "system",
      subjectId: row.id,
      subjectCode: `${ap.icao} · ${name}`,
      metadata: { airportId, name, isPrimary: values.isPrimary, isPreferred: values.isPreferred },
    });

    revalidatePath(`/admin/airports/${airportId}`);
    return { ok: true, id: row.id };
  } catch (err) {
    console.error("createFbo failed", err);
    return { ok: false, error: "DB_INSERT_FAILED (name dupe?)" };
  }
}

export async function deleteFbo(
  airportId: string,
  fboId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };
  if (!UUID_RE.test(fboId)) return { ok: false, error: "Bad fbo id" };

  const [target] = await db
    .select({ id: fbos.id, name: fbos.name, airportId: fbos.airportId })
    .from(fbos)
    .where(and(eq(fbos.id, fboId), eq(fbos.airportId, airportId)));
  if (!target) return { ok: false, error: "Not found" };

  await db.delete(fbos).where(eq(fbos.id, target.id));

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "fbo.delete",
    subjectType: "system",
    subjectId: target.id,
    metadata: { airportId, name: target.name },
  });

  revalidatePath(`/admin/airports/${airportId}`);
  return { ok: true };
}

export async function toggleFboFlag(
  airportId: string,
  fboId: string,
  field: "isPrimary" | "isPreferred",
  next: boolean,
): Promise<{ ok: true; value: boolean } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(airportId)) return { ok: false, error: "Bad airport id" };
  if (!UUID_RE.test(fboId)) return { ok: false, error: "Bad fbo id" };

  const [target] = await db
    .select({
      id: fbos.id,
      isPrimary: fbos.isPrimary,
      isPreferred: fbos.isPreferred,
      name: fbos.name,
    })
    .from(fbos)
    .where(and(eq(fbos.id, fboId), eq(fbos.airportId, airportId)));
  if (!target) return { ok: false, error: "Not found" };

  const before = target[field];
  if (before === next) return { ok: true, value: before };

  await db
    .update(fbos)
    .set({ [field]: next })
    .where(eq(fbos.id, target.id));

  // If we just promoted this FBO to is_primary, demote any sibling primaries
  // — only one primary per airport.
  if (field === "isPrimary" && next) {
    await db
      .update(fbos)
      .set({ isPrimary: false })
      .where(and(eq(fbos.airportId, airportId), ne(fbos.id, fboId)));
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: `fbo.${field}.toggle`,
    subjectType: "system",
    subjectId: target.id,
    diff: { [field]: { before, after: next } },
    metadata: { airportId, name: target.name },
  });

  revalidatePath(`/admin/airports/${airportId}`);
  return { ok: true, value: next };
}
