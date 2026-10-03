import { deskSettings, healthSnapshot, listTeam } from "@/domain/settings/queries";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";

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
  listTeam: listTeamRoute,
  health: healthRoute,
} satisfies Record<string, RouteDef>;
