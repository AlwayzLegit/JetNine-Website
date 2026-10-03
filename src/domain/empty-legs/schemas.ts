import { z } from "zod";
import { emptyLegStatusEnum } from "@/db/schema/empty-legs";

/**
 * Input shapes for the empty-leg operations. `*Input` is what an op takes
 * (and what a stored proposal is re-parsed with at approval time); `*Body`
 * is the API body, which leaves the id to the path and adds an optional
 * `reason` for the approver.
 */

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

export type EmptyLegStatus = (typeof emptyLegStatusEnum.enumValues)[number];

export function isEmptyLegStatus(v: string): v is EmptyLegStatus {
  return (emptyLegStatusEnum.enumValues as readonly string[]).includes(v);
}

const code = z.string().trim().toUpperCase();
const optionalText = z.string().trim().nullable().optional();
/** Whole-number counts and amounts the form posts; ranges are checked by the command so its wording stays the same. */
const whole = z.number().int();

export const EmptyLegCreateInput = z.object({
  aircraftTail: code.min(1).describe("Tail number of an aircraft on file; the operator and category come from it."),
  fromIcao: code.min(1),
  fromIata: code.optional(),
  fromCity: optionalText,
  toIcao: code.min(1),
  toIata: code.optional(),
  toCity: optionalText,
  wheelsUpAt: z.iso.datetime({ offset: true }).describe("Departure time, ISO 8601."),
  seats: whole.describe("Seats for sale, 1–19."),
  fullCharterRefUsd: whole.describe("What the same flight costs as a full charter, in whole dollars (at least 1000)."),
  listedPriceUsd: whole.describe("Asking price in whole dollars (at least 500, and at least 5% under the full charter)."),
  status: z.enum(emptyLegStatusEnum.enumValues).default("draft").describe("live puts it on the public board now."),
  flightMinutes: whole.nullable().optional(),
  distanceNm: whole.nullable().optional(),
  autoPriceDecay: z.boolean().default(false),
  minDiscountPct: z.number().default(30).describe("Floor for automatic price decay, 0–80."),
  petFriendly: z.boolean().default(false),
  headline: z.string().nullable().optional(),
  bodyCopy: z.string().nullable().optional(),
  visibility: z
    .object({
      publicBoard: z.boolean().default(false),
      memberMatch: z.boolean().default(false),
      weeklyDigest: z.boolean().default(false),
    })
    .default({ publicBoard: false, memberMatch: false, weeklyDigest: false }),
});
export type EmptyLegCreateInput = z.infer<typeof EmptyLegCreateInput>;

export const EmptyLegStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(emptyLegStatusEnum.enumValues),
});
export type EmptyLegStatusInput = z.infer<typeof EmptyLegStatusInput>;

export const EmptyLegCreateBody = EmptyLegCreateInput.extend({ reason });
export const EmptyLegStatusBody = EmptyLegStatusInput.omit({ id: true }).extend({ reason });
