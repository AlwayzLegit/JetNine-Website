import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { emptyLegs, type NewEmptyLeg } from "@/db/schema/empty-legs";
import { logAudit } from "@/lib/audit";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { err, ok, type Result } from "@/domain/result";
import type { EmptyLegCreateInput, EmptyLegStatus, EmptyLegStatusInput } from "./schemas";

/**
 * Empty-leg commands, shared by the admin's Server Actions, the API and
 * the approval queue through the ops in ./ops.ts. Each op has a `load*`
 * (the current rows and derived facts, re-read at approval time) and a
 * command that runs against that state. Nothing here checks the session
 * or revalidates: the op declares its paths and `runOp` handles both.
 *
 * The validation wording is what the new-leg form already shows, so the
 * Server Action wrapper passes the errors through verbatim.
 */

const NOT_FOUND = "Empty leg not found";

// ─── Create ──────────────────────────────────────────────────────────────

export type EmptyLegCreateState = {
  aircraft: { id: string; operatorId: string; category: NewEmptyLeg["category"] };
  wheelsUpAt: Date;
  /** Whole percent off the full-charter reference. */
  discountPct: number;
};

export async function loadForEmptyLegCreate(input: EmptyLegCreateInput): Promise<Result<EmptyLegCreateState>> {
  const wheelsUpAt = new Date(input.wheelsUpAt);
  if (Number.isNaN(wheelsUpAt.getTime())) return err("invalid", "Invalid wheels-up date");

  const { seats, fullCharterRefUsd: fullCharter, listedPriceUsd: listed } = input;
  if (seats < 1 || seats > 19) return err("invalid", "Seats 1–19");
  if (fullCharter < 1000) return err("invalid", "Full charter ref looks too low");
  if (listed < 500) return err("invalid", "Listed price looks too low");
  if (listed >= fullCharter) return err("invalid", "Listed must be less than full charter");

  const discountPct = Math.round(((fullCharter - listed) / fullCharter) * 100);
  if (discountPct < 5) return err("invalid", "Discount under 5% — operator margin floor blocks publish.");

  // Look up the aircraft + operator + category by tail.
  const [ac] = await db
    .select({ id: aircraft.id, operatorId: aircraft.operatorId, category: aircraft.category })
    .from(aircraft)
    .where(eq(aircraft.tailNumber, input.aircraftTail));
  if (!ac) return err("not_found", `Unknown tail ${input.aircraftTail}`);

  return ok({ aircraft: ac, wheelsUpAt, discountPct });
}

/** Insert the leg (code comes from the DB trigger) and record it in History. */
export async function createEmptyLeg(
  actor: Actor,
  input: EmptyLegCreateInput,
  state: EmptyLegCreateState,
): Promise<Result<{ id: string; code: string }>> {
  const { aircraft: ac, wheelsUpAt, discountPct } = state;
  const a = auditFields(actor);

  const values: NewEmptyLeg = {
    aircraftId: ac.id,
    operatorId: ac.operatorId,
    category: ac.category,
    fromIcao: input.fromIcao,
    fromIata: input.fromIata || null,
    fromCity: input.fromCity ?? null,
    toIcao: input.toIcao,
    toIata: input.toIata || null,
    toCity: input.toCity ?? null,
    wheelsUpAt,
    flightMinutes: input.flightMinutes || null,
    distanceNm: input.distanceNm || null,
    seatsAvailable: input.seats,
    fullCharterRefUsd: input.fullCharterRefUsd,
    listedPriceUsd: input.listedPriceUsd,
    discountPct,
    autoPriceDecay: input.autoPriceDecay,
    minDiscountPct: Math.max(0, Math.min(80, input.minDiscountPct)),
    reserveLockMinutes: 30,
    petFriendly: input.petFriendly,
    headline: input.headline || null,
    bodyCopy: input.bodyCopy || null,
    visibilityFlags: {
      publicBoard: input.visibility.publicBoard,
      memberMatch: input.visibility.memberMatch,
      weeklyDigest: input.visibility.weeklyDigest,
      affiliateFeed: false,
    },
    status: input.status,
    createdByUserId: a.actorUserId,
    boardGoLiveAt: input.status === "live" ? new Date() : null,
    expiresAt: wheelsUpAt,
  };

  let row: { id: string; code: string };
  try {
    [row] = await db.insert(emptyLegs).values(values).returning({ id: emptyLegs.id, code: emptyLegs.code });
  } catch (e) {
    console.error("createEmptyLeg failed", e);
    return err("internal", "DB_INSERT_FAILED");
  }

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "empty_leg.create",
    subjectType: "empty_leg",
    subjectId: row.id,
    subjectCode: row.code,
    metadata: {
      ...a.metadata,
      route: `${input.fromIcao}→${input.toIcao}`,
      wheelsUpAt: wheelsUpAt.toISOString(),
      seats: input.seats,
      listed: input.listedPriceUsd,
      fullCharter: input.fullCharterRefUsd,
      discountPct,
      status: input.status,
    },
  });

  return ok({ id: row.id, code: row.code });
}

// ─── Status ──────────────────────────────────────────────────────────────
// The board only lists `live`, so this is also the unlist control for a
// sold or stale leg.

export type EmptyLegStatusState = {
  leg: { id: string; code: string; status: EmptyLegStatus };
};

export async function loadEmptyLegForStatus(input: EmptyLegStatusInput): Promise<Result<EmptyLegStatusState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  const [leg] = await db
    .select({ id: emptyLegs.id, code: emptyLegs.code, status: emptyLegs.status })
    .from(emptyLegs)
    .where(eq(emptyLegs.id, input.id));
  if (!leg) return err("not_found", NOT_FOUND);
  return ok({ leg });
}

/** True when this change puts the leg on the public board (and in front of the watchlist cron). */
export function goesLive(input: EmptyLegStatusInput, state: EmptyLegStatusState): boolean {
  return input.status === "live" && state.leg.status !== "live";
}

export async function setEmptyLegStatus(
  actor: Actor,
  input: EmptyLegStatusInput,
  state: EmptyLegStatusState,
): Promise<Result<{ id: string; status: EmptyLegStatus }>> {
  const { leg } = state;
  const a = auditFields(actor);

  await db.update(emptyLegs).set({ status: input.status, updatedAt: new Date() }).where(eq(emptyLegs.id, leg.id));

  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "empty_leg.status.update",
    subjectType: "empty_leg",
    subjectId: leg.id,
    subjectCode: leg.code,
    diff: { status: { before: leg.status, after: input.status } },
    metadata: a.metadata,
  });

  return ok({ id: leg.id, status: input.status });
}
