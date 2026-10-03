import { z } from "zod";
import { memberTierEnum } from "@/db/schema/enums";
import { reserveTxKindEnum } from "@/db/schema/memberships";

/**
 * Input shapes for the client (member) operations. Same split as the
 * requests: `*Input` is what the op takes, `*Body` is the API body (id from
 * the path, optional `reason` for the approver).
 */

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

export type ReserveTxKind = (typeof reserveTxKindEnum.enumValues)[number];
export type MemberTier = (typeof memberTierEnum.enumValues)[number];

/** The ledger caps a single entry at five million dollars either way. */
export const MAX_LEDGER_USD = 5_000_000;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const E164_RE = /^\+[1-9]\d{6,14}$/;

// ─── Reserve ledger ──────────────────────────────────────────────────────

export const ClientLedgerAddInput = z.object({
  id: z.uuid(),
  kind: z.enum(reserveTxKindEnum.enumValues).describe("top_up, credit_accrual, refund, charter_draw or adjustment."),
  amount: z
    .number()
    .int()
    .refine((n) => Math.abs(n) >= 1 && Math.abs(n) <= MAX_LEDGER_USD, "Amount out of bounds")
    .describe(
      "Whole dollars. The magnitude for top_up, credit_accrual, refund and charter_draw (the sign follows the kind); signed for adjustment.",
    ),
  description: z.string().trim().max(500).optional().describe("Defaults to \"<kind> via dispatch\"."),
});
export type ClientLedgerAddInput = z.infer<typeof ClientLedgerAddInput>;

export const ClientLedgerAddBody = ClientLedgerAddInput.omit({ id: true }).extend({ reason });

// ─── Invite ──────────────────────────────────────────────────────────────

const name = z.string().trim().max(80).nullable().optional();

export const ClientInviteInput = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_RE, "Email looks invalid").max(320),
  firstName: name,
  lastName: name,
  phoneE164: z.string().trim().regex(E164_RE, "Phone must be E.164 (+15551234567)").nullable().optional(),
  tier: z.enum(memberTierEnum.enumValues).default("on_demand"),
  companyName: z.string().trim().max(140).nullable().optional(),
});
export type ClientInviteInput = z.infer<typeof ClientInviteInput>;

export const ClientInviteBody = ClientInviteInput.extend({ reason });
