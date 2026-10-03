import type { z } from "zod";
import { runOp } from "@/domain/ops/registry";
import { notificationPrefOp, replyPromiseOp, testEmailOp } from "@/domain/settings/ops";
import { deskSettings, healthSnapshot, listTeam } from "@/domain/settings/queries";
import { DeskSettingsBody } from "@/domain/settings/schemas";
import { err, ok } from "@/domain/result";
import { teamInviteOp, teamRemoveOp, teamRoleOp } from "@/domain/team/ops";
import { TeamInviteBody, TeamRemoveBody, TeamRoleBody } from "@/domain/team/schemas";
import type { RouteDef } from "../handler";
import { opRouteOutput } from "../ops";

/**
 * Settings and the team. The reads need `read`; the writes go through the
 * ops registry. Changing the desk's settings needs the `settings`
 * permission and changing who works the desk needs `admin`, so both are
 * owners only, and a key that asks before acting gets a 202 for every one
 * of them except the test email, which only ever reaches the key's own
 * person.
 */

const ASKS = "A key that asks before acting gets a 202 and an owner decides in Messages › Needs your OK. `reason` is an optional line for the approver.";

/** Team emails are for owners; a team key with "read" does not get them. */
function isOwner(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

const deskSettingsRoute: RouteDef = {
  method: "GET",
  path: "/settings/desk",
  operationId: "deskSettings",
  summary: "Desk-wide settings",
  description: "The reply-time promise (minutes a new request gets before a reply is late), its choices, and the default notification toggles. No per-person preferences and no secrets.",
  tag: "Settings",
  scope: "read",
  run: async () => ok({ data: await deskSettings() }),
};

const ONE_THING = "Change one thing per call: the reply promise or notifications.";

const updateDeskSettingsRoute: RouteDef = {
  method: "PATCH",
  path: "/settings/desk",
  operationId: "updateDeskSettings",
  summary: "Change a desk setting",
  description:
    "One change per call. Send `replyPromiseMinutes` (15, 30 or 60) to change how long a new request gets before a reply is late, or `notifications` with exactly one toggle, e.g. `{ \"newRequest\": false }`, to turn that notification on or off for the person this key acts as. A body with both, with no change, or with more than one toggle is refused with 422. " +
    ASKS +
    " Returns what changed; `changed` is false when the reply promise already had that value.",
  tag: "Settings",
  scope: "settings",
  approval: "always",
  body: DeskSettingsBody,
  run: async ({ actor, body }) => {
    const { reason, replyPromiseMinutes, notifications } = body as z.infer<typeof DeskSettingsBody>;
    const toggles = Object.entries(notifications ?? {}).filter(([, v]) => typeof v === "boolean");
    const hasPromise = replyPromiseMinutes !== undefined;
    if (hasPromise && toggles.length) return err("invalid", ONE_THING);
    if (hasPromise) return opRouteOutput(await runOp(replyPromiseOp, actor, { minutes: replyPromiseMinutes }, { reason }));
    if (toggles.length !== 1) return err("invalid", "Send `replyPromiseMinutes`, or `notifications` with exactly one toggle.");
    const [kind, on] = toggles[0];
    return opRouteOutput(await runOp(notificationPrefOp, actor, { kind, on }, { reason }));
  },
};

const testEmailRoute: RouteDef = {
  method: "POST",
  path: "/settings/test-email",
  operationId: "sendTestEmail",
  summary: "Send yourself a test email",
  description:
    "Emails the person this key acts as through the same layer the desk uses for clients, so you can see that email is working. Nobody else is contacted, so it never needs approval. Returns whether it was sent and by which provider.",
  tag: "Settings",
  scope: "settings",
  approval: "never",
  run: async ({ actor }) => opRouteOutput(await runOp(testEmailOp, actor, {})),
};

const listTeamRoute: RouteDef = {
  method: "GET",
  path: "/team",
  operationId: "listTeam",
  summary: "Who works the desk",
  description: "Everyone who can open the desk, owners first: name, email and role. Owners only: the key must act as an owner.",
  tag: "Settings",
  scope: "read",
  run: async ({ actor }) => {
    if (!isOwner(actor.role)) return err("forbidden", "Owners only.");
    return ok({ data: await listTeam() });
  },
};

const inviteTeammateRoute: RouteDef = {
  method: "POST",
  path: "/team",
  operationId: "inviteTeammate",
  summary: "Invite someone to the desk",
  description:
    "Gives `email` access to the desk as `role`: `owner` (everything, including reports and money) or `team` (requests, trips, clients, messages; the default). Someone without an account gets a sign-in invitation email; someone who already has one is given the role at once. 409 when they are already on the desk. " +
    ASKS +
    " Returns the person's id, name and role, and `invited` when an invitation went out.",
  tag: "Team",
  scope: "admin",
  approval: "always",
  body: TeamInviteBody,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const { reason, ...input } = body as z.infer<typeof TeamInviteBody>;
    return opRouteOutput(await runOp(teamInviteOp, actor, input, { reason }), 201);
  },
};

const setTeammateRoleRoute: RouteDef = {
  method: "PATCH",
  path: "/team/{id}",
  operationId: "setTeammateRole",
  summary: "Change someone's role",
  description:
    "Makes the person an `owner` or part of the `team`. You cannot change your own role, a founding owner cannot be changed from here, and at least one owner must remain (409). 404 when the id is not someone on the desk. " +
    ASKS +
    " Returns the person's name and role; `changed` is false when they already had it.",
  tag: "Team",
  scope: "admin",
  approval: "always",
  body: TeamRoleBody,
  run: async ({ actor, params, body }) => {
    const { reason, ...input } = body as z.infer<typeof TeamRoleBody>;
    return opRouteOutput(await runOp(teamRoleOp, actor, { id: params.id, ...input }, { reason }));
  },
};

const removeTeammateRoute: RouteDef = {
  method: "DELETE",
  path: "/team/{id}",
  operationId: "removeTeammate",
  summary: "Remove someone from the desk",
  description:
    "Takes away desk access: they keep their account but can no longer sign in here. You cannot remove yourself, a founding owner cannot be removed from here, and at least one owner must remain (409). 404 when the id is not someone on the desk. " +
    ASKS +
    " The body is optional.",
  tag: "Team",
  scope: "admin",
  approval: "always",
  body: TeamRemoveBody,
  run: async ({ actor, params, body }) => {
    const { reason } = (body ?? {}) as z.infer<typeof TeamRemoveBody>;
    return opRouteOutput(await runOp(teamRemoveOp, actor, { id: params.id }, { reason }));
  },
};

const healthRoute: RouteDef = {
  method: "GET",
  path: "/health",
  operationId: "health",
  summary: "Is everything connected",
  description: "The same checks as the public /api/health (database, email, texts, payments, error tracking: configured or not, never the keys) plus how many emails went out today.",
  tag: "Settings",
  scope: "read",
  run: async () => ok({ data: await healthSnapshot() }),
};

export const SETTINGS_ROUTES = {
  deskSettings: deskSettingsRoute,
  updateDeskSettings: updateDeskSettingsRoute,
  sendTestEmail: testEmailRoute,
  listTeam: listTeamRoute,
  inviteTeammate: inviteTeammateRoute,
  setTeammateRole: setTeammateRoleRoute,
  removeTeammate: removeTeammateRoute,
  health: healthRoute,
} satisfies Record<string, RouteDef>;
