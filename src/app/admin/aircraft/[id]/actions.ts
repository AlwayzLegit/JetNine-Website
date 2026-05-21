"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  aircraft,
  aircraftStatusEnum,
  aircraftWifiEnum,
  type NewAircraft,
} from "@/db/schema/aircraft";
import { aircraftCategoryEnum } from "@/db/schema/enums";
import { operators } from "@/db/schema/operators";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const TAIL_RE = /^[A-Z0-9-]{3,16}$/;
const ICAO_RE = /^[A-Z0-9]{4}$/;
const STATUSES = aircraftStatusEnum.enumValues as readonly string[];
const WIFIS = aircraftWifiEnum.enumValues as readonly string[];
const CATS = aircraftCategoryEnum.enumValues as readonly string[];

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

function pickDate(form: FormData, name: string): string | null {
  const raw = pickString(form, name);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function aircraftValuesFromForm(formData: FormData): {
  ok: true;
  values: NewAircraft;
} | { ok: false; error: string } {
  const tail = pickString(formData, "tailNumber").toUpperCase();
  if (!TAIL_RE.test(tail)) return { ok: false, error: "Tail must be 3–16 chars (A-Z, 0-9, -)" };

  const operatorId = pickString(formData, "operatorId");
  if (!UUID_RE.test(operatorId)) return { ok: false, error: "Pick an operator" };

  const category = pickString(formData, "category");
  if (!CATS.includes(category)) return { ok: false, error: "Invalid category" };

  const makeModel = pickString(formData, "makeModel");
  if (makeModel.length < 2) return { ok: false, error: "Make/model required" };
  if (makeModel.length > 100) return { ok: false, error: "Make/model too long" };

  const seats = pickInt(formData, "seats");
  if (seats === null || seats < 1 || seats > 19) {
    return { ok: false, error: "Seats 1–19" };
  }

  const rangeNm = pickInt(formData, "rangeNm");
  if (rangeNm === null || rangeNm < 100 || rangeNm > 10000) {
    return { ok: false, error: "Range 100–10000 NM" };
  }

  const speedKt = pickInt(formData, "speedKt");
  if (speedKt === null || speedKt < 100 || speedKt > 700) {
    return { ok: false, error: "Speed 100–700 kt" };
  }

  const yearManufactured = pickInt(formData, "yearManufactured");
  if (yearManufactured !== null && (yearManufactured < 1960 || yearManufactured > 2100)) {
    return { ok: false, error: "Year of manufacture looks wrong" };
  }

  const baseIcao = pickString(formData, "baseIcao").toUpperCase() || null;
  if (baseIcao && !ICAO_RE.test(baseIcao)) {
    return { ok: false, error: "Base ICAO must be 4 chars" };
  }

  const wifiType = pickString(formData, "wifiType") || "none";
  if (!WIFIS.includes(wifiType)) return { ok: false, error: "Invalid Wi-Fi type" };

  const statusRaw = pickString(formData, "status") || "available";
  if (!STATUSES.includes(statusRaw)) return { ok: false, error: "Invalid status" };

  const values: NewAircraft = {
    tailNumber: tail,
    operatorId,
    category: category as NewAircraft["category"],
    makeModel,
    yearManufactured,
    seats,
    rangeNm,
    speedKt,
    wifiType: wifiType as NewAircraft["wifiType"],
    cabinHeightIn: pickInt(formData, "cabinHeightIn"),
    standupCabin: pickBool(formData, "standupCabin"),
    lavatoryEnclosed: pickBool(formData, "lavatoryEnclosed"),
    lieflatCapable: pickBool(formData, "lieflatCapable"),
    petFriendly: pickBool(formData, "petFriendly"),
    flightAttendantStandard: pickBool(formData, "flightAttendantStandard"),
    baseIcao,
    totalHours: pickInt(formData, "totalHours"),
    lastCCheckOn: pickDate(formData, "lastCCheckOn"),
    status: statusRaw as NewAircraft["status"],
  };
  return { ok: true, values };
}

export type CreateAircraftResult =
  | { ok: true; id: string; tailNumber: string }
  | { ok: false; error: string };

export async function createAircraft(formData: FormData): Promise<CreateAircraftResult> {
  const actor = await requireAdmin();

  const parsed = aircraftValuesFromForm(formData);
  if (!parsed.ok) return parsed;

  // Verify operator exists.
  const [op] = await db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .where(eq(operators.id, parsed.values.operatorId));
  if (!op) return { ok: false, error: "Operator not found" };

  // Tail uniqueness pre-check.
  const [conflict] = await db
    .select({ id: aircraft.id })
    .from(aircraft)
    .where(eq(aircraft.tailNumber, parsed.values.tailNumber));
  if (conflict) return { ok: false, error: `Tail ${parsed.values.tailNumber} already on file` };

  try {
    const [row] = await db
      .insert(aircraft)
      .values(parsed.values)
      .returning({ id: aircraft.id, tailNumber: aircraft.tailNumber });

    await logAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "aircraft.create",
      subjectType: "aircraft",
      subjectId: row.id,
      subjectCode: row.tailNumber,
      metadata: {
        operatorId: parsed.values.operatorId,
        operatorName: op.name,
        category: parsed.values.category,
        makeModel: parsed.values.makeModel,
        seats: parsed.values.seats,
      },
    });

    revalidatePath("/admin/aircraft");
    revalidatePath("/admin/ops");
    revalidatePath(`/admin/operators/${parsed.values.operatorId}`);
    return { ok: true, id: row.id, tailNumber: row.tailNumber };
  } catch (err) {
    console.error("createAircraft failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}

export async function updateAircraft(
  aircraftId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!UUID_RE.test(aircraftId)) return { ok: false, error: "Bad aircraft id" };

  const [before] = await db.select().from(aircraft).where(eq(aircraft.id, aircraftId));
  if (!before) return { ok: false, error: "Not found" };

  const parsed = aircraftValuesFromForm(formData);
  if (!parsed.ok) return parsed;

  // Tail collision (exclude self).
  if (parsed.values.tailNumber !== before.tailNumber) {
    const [conflict] = await db
      .select({ id: aircraft.id })
      .from(aircraft)
      .where(
        and(
          eq(aircraft.tailNumber, parsed.values.tailNumber),
          ne(aircraft.id, aircraftId),
        ),
      );
    if (conflict) {
      return { ok: false, error: `Another aircraft already uses ${parsed.values.tailNumber}` };
    }
  }

  // Operator existence check on change.
  if (parsed.values.operatorId !== before.operatorId) {
    const [op] = await db
      .select({ id: operators.id })
      .from(operators)
      .where(eq(operators.id, parsed.values.operatorId));
    if (!op) return { ok: false, error: "Operator not found" };
  }

  await db.update(aircraft).set(parsed.values).where(eq(aircraft.id, aircraftId));

  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of Object.keys(parsed.values) as (keyof NewAircraft)[]) {
    const a = (before as Record<string, unknown>)[k];
    const b = (parsed.values as Record<string, unknown>)[k];
    if (a !== b && JSON.stringify(a) !== JSON.stringify(b)) {
      diff[k] = { before: a, after: b };
    }
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "aircraft.update",
    subjectType: "aircraft",
    subjectId: aircraftId,
    subjectCode: parsed.values.tailNumber,
    diff: Object.keys(diff).length ? diff : null,
  });

  revalidatePath("/admin/aircraft");
  revalidatePath(`/admin/aircraft/${aircraftId}`);
  revalidatePath("/admin/ops");
  if (before.operatorId !== parsed.values.operatorId) {
    revalidatePath(`/admin/operators/${before.operatorId}`);
    revalidatePath(`/admin/operators/${parsed.values.operatorId}`);
  }
  return { ok: true };
}
