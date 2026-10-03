import { z } from "zod";
import { DESK_MESSAGE_CHANNELS } from "@/domain/requests/schemas";

/**
 * Input shapes for the trip operations. Same split as the requests:
 * `*Input` is what the op takes, `*Body` is the API body (id from the
 * path, optional `reason` for the approver).
 */

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

export const TripMessageInput = z.object({
  id: z.uuid(),
  channel: z.enum(DESK_MESSAGE_CHANNELS),
  body: z.string().trim().min(1).max(4000),
  toAddress: z.string().trim().min(1).max(320).optional().describe("Defaults to the client's email or phone for the channel."),
});
export type TripMessageInput = z.infer<typeof TripMessageInput>;

export const TripMessageBody = TripMessageInput.omit({ id: true }).extend({ reason });
