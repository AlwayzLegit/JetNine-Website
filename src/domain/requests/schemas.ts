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
