import { z } from "zod";
import { quoteStatusEnum } from "@/db/schema/quotes";

/**
 * Input shapes for the request (quote) operations. The `*Input` schemas
 * are what an op takes (and what a stored proposal is re-parsed with at
 * approval time); the `*Body` schemas are the API bodies, which leave the
 * id to the path and add an optional `reason` for the approver.
 */

/** Channels a person on the desk may post on a thread; "system" is reserved for auto-notes. */
export const DESK_MESSAGE_CHANNELS = ["inapp", "email", "sms", "whatsapp", "call", "voicemail"] as const;
export type DeskMessageChannel = (typeof DESK_MESSAGE_CHANNELS)[number];

export function isDeskMessageChannel(v: string): v is DeskMessageChannel {
  return (DESK_MESSAGE_CHANNELS as readonly string[]).includes(v);
}

/** Channels whose message actually leaves the building; the rest are desk-side notes. */
export const TRANSMITTING_CHANNELS: ReadonlySet<DeskMessageChannel> = new Set<DeskMessageChannel>(["email", "sms", "whatsapp"]);

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

export const RequestStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(quoteStatusEnum.enumValues),
});
export type RequestStatusInput = z.infer<typeof RequestStatusInput>;

export const RequestMessageInput = z.object({
  id: z.uuid(),
  channel: z.enum(DESK_MESSAGE_CHANNELS),
  body: z.string().trim().min(1).max(4000),
  toAddress: z.string().trim().min(1).max(320).optional().describe("Defaults to the client's email or phone for the channel."),
});
export type RequestMessageInput = z.infer<typeof RequestMessageInput>;

export const SendOptionsInput = z.object({
  id: z.uuid(),
});
export type SendOptionsInput = z.infer<typeof SendOptionsInput>;

export const RequestStatusBody = RequestStatusInput.omit({ id: true }).extend({ reason });
export const RequestMessageBody = RequestMessageInput.omit({ id: true }).extend({ reason });
export const SendOptionsBody = z.object({ reason });

// ─── Assignment, client link, soft holds ────────────────────────────────

export const RequestAssignInput = z.object({
  id: z.uuid(),
  staffId: z.uuid().nullable().describe("The dispatcher to assign, or null to unassign."),
});
export type RequestAssignInput = z.infer<typeof RequestAssignInput>;

export const RequestLinkClientInput = z.object({
  id: z.uuid(),
  memberId: z.uuid().nullable().describe("The client to link, or null to unlink."),
});
export type RequestLinkClientInput = z.infer<typeof RequestLinkClientInput>;

export const HoldCreateInput = z.object({
  id: z.uuid(),
  aircraftId: z.uuid(),
});
export type HoldCreateInput = z.infer<typeof HoldCreateInput>;

export const HoldReleaseInput = z.object({
  id: z.uuid(),
  blockId: z.uuid(),
});
export type HoldReleaseInput = z.infer<typeof HoldReleaseInput>;

export const RequestAssignBody = RequestAssignInput.omit({ id: true }).extend({ reason });
export const RequestLinkClientBody = RequestLinkClientInput.omit({ id: true }).extend({ reason });
export const HoldCreateBody = HoldCreateInput.omit({ id: true }).extend({ reason });
export const HoldReleaseBody = z.object({ reason });

// ─── Sourced options ─────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max).nullable().optional();
const year = z.number().int().min(1950).max(2100).nullable().optional();
const minutes = z.number().int().min(0).max(10_000).nullable().optional();

/**
 * What a person pastes from Avinode for one airframe. Every field is
 * optional: on add, a missing field is empty; on update, a missing field
 * keeps its value. Cost, markup and dispatcher notes need the `money`
 * permission (checked in the command, since only it sees the actor).
 */
export const OptionFields = z.object({
  avinodeRef: text(120),
  aircraftType: text(120),
  tailNumber: text(20),
  isFloatingFleet: z.boolean().optional(),
  yearOfMake: year,
  category: text(40).describe("Aircraft category in any common spelling (light, midsize, super-mid, heavy, ultra long range …)."),
  paxCapacity: z.number().int().min(0).max(100).nullable().optional(),
  refurbInteriorYear: year,
  refurbExteriorYear: year,
  operatorNameRaw: text(200).describe("The seller's name as pasted; matched against the operators list on save."),
  positioningTimeMin: minutes,
  positioningAirport: text(20),
  totalFlightTimeMin: minutes,
  operatorCostUsd: z.number().int().min(0).max(99_999_999).nullable().optional().describe("Needs the money permission."),
  markupType: z.enum(["percent", "flat"]).optional().describe("Needs the money permission."),
  markupValue: z.number().min(0).max(99_999_999).optional().describe("Percent, or whole dollars for a flat markup. Needs the money permission."),
  dispatcherNotes: text(4000).describe("Needs the money permission."),
});
export type OptionFields = z.infer<typeof OptionFields>;

/** The fields a key needs the `money` permission to set. */
export const OPTION_MONEY_FIELDS = ["operatorCostUsd", "markupType", "markupValue", "dispatcherNotes"] as const satisfies readonly (keyof OptionFields)[];

export const OptionAddInput = OptionFields.extend({ id: z.uuid() });
export type OptionAddInput = z.infer<typeof OptionAddInput>;

export const OptionUpdateInput = OptionFields.extend({ id: z.uuid(), optionId: z.uuid() });
export type OptionUpdateInput = z.infer<typeof OptionUpdateInput>;

export const OptionRefInput = z.object({ id: z.uuid(), optionId: z.uuid() });
export type OptionRefInput = z.infer<typeof OptionRefInput>;

export const OptionAddBody = OptionFields.extend({ reason });
export const OptionUpdateBody = OptionFields.extend({ reason });
export const OptionRefBody = z.object({ reason });
