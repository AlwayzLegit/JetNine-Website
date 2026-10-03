import { z } from "zod";
import { tripStatusEnum } from "@/db/schema/trips";
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

export const TripStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(tripStatusEnum.enumValues),
});
export type TripStatusInput = z.infer<typeof TripStatusInput>;

export const TripStatusBody = TripStatusInput.omit({ id: true }).extend({ reason });

// ─── Invoice editor (draft → due) ────────────────────────────────────────

/**
 * Stripe's per-line-item ceiling is 99,999,999 cents; our amounts are
 * whole USD, so the same number is a safe upper bound in dollars too.
 */
export const MAX_INVOICE_USD = 99_999_999;

const usdField = z.number().int().min(0).max(MAX_INVOICE_USD).nullable().optional();

/** YYYY-MM-DD that also parses as a real date. */
const dayField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Must be a valid YYYY-MM-DD")
  .nullable()
  .optional();

/**
 * The money fields are whole dollars; a field left out keeps its value and
 * null clears it. `dueOn` left out or null keeps the current due date.
 */
export const InvoiceUpdateInput = z.object({
  id: z.uuid(),
  intent: z.enum(["save", "finalize"]).describe("save keeps the invoice a draft; finalize moves it to due and emails the client."),
  subtotalUsd: usdField,
  fetUsd: usdField.describe("7.5% federal excise tax."),
  segmentFeeUsd: usdField,
  totalUsd: usdField.describe("Must be above zero to finalize."),
  notes: z.string().trim().max(2000).nullable().optional().describe("Internal notes; never shown to the client."),
  dueOn: dayField.describe("YYYY-MM-DD. Finalizing without one, on an invoice that has none, sets a week from today."),
});
export type InvoiceUpdateInput = z.infer<typeof InvoiceUpdateInput>;

export const InvoiceUpdateBody = InvoiceUpdateInput.omit({ id: true }).extend({ reason });
