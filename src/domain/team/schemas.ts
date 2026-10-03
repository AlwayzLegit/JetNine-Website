import { z } from "zod";

/**
 * Input shapes for the team operations (Settings › Team): invite someone
 * to the desk, change their role, remove them. `*Input` is what an op
 * takes (and what a stored proposal is re-parsed with at approval time);
 * `*Body` is the API body, which leaves the id to the path and adds an
 * optional `reason` for the approver.
 *
 * Two words map onto the database roles: Owner = admin, Team =
 * dispatcher. Every message below is the one the desk has always shown.
 */

const reason = z.string().trim().max(2000).optional().describe("One line for the approver: why you are doing this.");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DESK_ROLES = ["owner", "team"] as const;
const deskRole = z.enum(DESK_ROLES, { error: "Pick Owner or Team." }).describe("owner = everything; team = requests, trips, clients, messages.");

/** A name part; blank counts as null. */
const namePart = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .default(null)
  .transform((v) => v || null);

export const TeamInviteInput = z.object({
  email: z.string().trim().toLowerCase().refine((v) => EMAIL_RE.test(v), "That email does not look right."),
  firstName: namePart,
  lastName: namePart,
  role: deskRole.default("team"),
});
export type TeamInviteInput = z.infer<typeof TeamInviteInput>;

export const TeamRoleInput = z.object({
  id: z.uuid(),
  role: deskRole,
});
export type TeamRoleInput = z.infer<typeof TeamRoleInput>;

export const TeamRefInput = z.object({ id: z.uuid() });
export type TeamRefInput = z.infer<typeof TeamRefInput>;

export const TeamInviteBody = TeamInviteInput.extend({ reason });
export const TeamRoleBody = TeamRoleInput.omit({ id: true }).extend({ reason });
export const TeamRemoveBody = z.object({ reason });
