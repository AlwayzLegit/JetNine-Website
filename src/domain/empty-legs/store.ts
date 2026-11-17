import { d1Db, dbTarget } from "@/db";
import type { Aircraft } from "@/db/schema/aircraft";
import type { Airport } from "@/db/schema/airports";
import type { EmptyLeg, NewEmptyLeg } from "@/db/schema/empty-legs";
import type { Operator } from "@/db/schema/operators";
import { d1EmptyLegStore } from "./store-d1";
import { pgEmptyLegStore } from "./store-pg";

// The empty-legs domain's one door to the database (OPS-113): the empty_legs
// table and its code sequence. There is one adapter per database, chosen per
// request by dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1"
// (staging first; the code refuses "d1" in production, see src/db/target.mjs).
// Return types are plain rows of the existing Postgres types, so callers keep
// their shape. Watchlists and their matches stay on Postgres: they are the
// next row of the move.

/** One row of the admin list and the v1 API. */
export type AdminLegRow = Pick<
  EmptyLeg,
  | "id"
  | "code"
  | "status"
  | "fromIata"
  | "fromIcao"
  | "toIata"
  | "toIcao"
  | "wheelsUpAt"
  | "seatsAvailable"
  | "listedPriceUsd"
  | "discountPct"
  | "operatorId"
> & { operatorName: Operator["name"] };

/** An available aircraft with its operator, for the new-leg form. */
export type AvailableTailRow = { tail: string; makeModel: string; operator: string };

/** What the new-leg form needs from a tail number. */
export type TailRef = { id: string; operatorId: string; category: Aircraft["category"] };

export type LegStatusRow = Pick<EmptyLeg, "id" | "code" | "status">;

/** One live leg on the public board, with the aircraft, the operator and the departure airport. */
export type BoardLegRow = Pick<
  EmptyLeg,
  | "id"
  | "code"
  | "category"
  | "fromIata"
  | "fromIcao"
  | "fromCity"
  | "fromName"
  | "toIata"
  | "toIcao"
  | "toCity"
  | "toName"
  | "wheelsUpAt"
  | "flightMinutes"
  | "discountPct"
> & {
  seats: EmptyLeg["seatsAvailable"];
  priceWas: EmptyLeg["fullCharterRefUsd"];
  priceNow: EmptyLeg["listedPriceUsd"];
  makeModel: Aircraft["makeModel"] | null;
  yearManufactured: Aircraft["yearManufactured"] | null;
  argusRating: Operator["argusRating"];
  wyvernWingman: Operator["wyvernWingman"];
  /** State of the departure airport, when the airports table has it. */
  fromRegion: Airport["region"] | null;
  fromCountry: Airport["countryIso2"] | null;
};

/** One sold leg for the board's "recently sold" strip. */
export type SoldLegRow = Pick<
  EmptyLeg,
  | "id"
  | "code"
  | "category"
  | "fromIata"
  | "fromIcao"
  | "fromCity"
  | "toIata"
  | "toIcao"
  | "toCity"
  | "discountPct"
  | "soldAt"
  | "boardGoLiveAt"
  | "createdAt"
> & { priceNow: EmptyLeg["listedPriceUsd"] };

/** One live leg that has not departed, for the watchlist cron. */
export type LiveLegRow = Pick<
  EmptyLeg,
  | "id"
  | "code"
  | "category"
  | "fromIcao"
  | "fromIata"
  | "fromCity"
  | "fromName"
  | "toIcao"
  | "toIata"
  | "toCity"
  | "toName"
  | "wheelsUpAt"
  | "listedPriceUsd"
  | "fullCharterRefUsd"
  | "discountPct"
>;

export interface EmptyLegStore {
  /** The most recent legs by wheels-up time, newest first, each with its operator. */
  adminLegs(limit: number): Promise<AdminLegRow[]>;
  /** Available aircraft with their operator, operator name without regard to case, then tail. */
  availableTails(): Promise<AvailableTailRow[]>;
  tailRef(tail: string): Promise<TailRef | undefined>;
  /**
   * Makes the next EL code for the year of `now` and inserts the leg with it,
   * as one unit: when the insert fails, the number is not used up.
   */
  createLeg(values: NewEmptyLeg, now: Date): Promise<{ id: string; code: string }>;
  legForStatus(id: string): Promise<LegStatusRow | undefined>;
  setStatus(id: string, status: EmptyLeg["status"], at: Date): Promise<void>;
  /** Live legs for the public board, soonest wheels-up first. */
  boardLegs(): Promise<BoardLegRow[]>;
  /** The latest sold legs, most recently sold first; a sold leg with no sold_at comes first, as on Postgres. */
  recentlySold(limit: number): Promise<SoldLegRow[]>;
  /** Live legs that depart after `now`, soonest first. */
  liveLegsAfter(now: Date): Promise<LiveLegRow[]>;
  /** Legs that are scheduled or live. */
  countActive(): Promise<number>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function emptyLegStore(): EmptyLegStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1EmptyLegStore(client);
  }
  return pgEmptyLegStore();
}
