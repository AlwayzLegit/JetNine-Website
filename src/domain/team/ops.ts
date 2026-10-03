import { DESK_ROLE_WORDS } from "@/lib/desk-status";
import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import { err, type Result } from "@/domain/result";
import {
  inviteTeammate,
  loadForInvite,
  loadTeammate,
  removeTeammate,
  setTeammateRole,
  type TeammateState,
} from "./commands";
import { TeamInviteInput, TeamRefInput, TeamRoleInput } from "./schemas";

/**
 * Operations on who works the desk. Giving, changing or taking away access
 * is an `admin` matter: only owners hold the permission, and a supervised
 * key's change waits for one.
 */

type Nothing = Record<string, never>;

const TEAM_PATH = "/admin/settings/team";

export const teamInviteOp = defineOp<TeamInviteInput, Nothing>({
  id: "team.invite",
  scope: "admin",
  schema: TeamInviteInput,
  load: loadForInvite,
  risk: () => "access",
  summary: (input) => `Invite ${input.email} to the desk as ${DESK_ROLE_WORDS[input.role].label}`,
  preview: () => "Sends a sign-in invitation email.",
  subject: (input) => ({ type: "user_role", id: null, code: input.email }),
  run: (actor, input) => inviteTeammate(actor, input),
  revalidate: () => [TEAM_PATH],
});

/** The account owner is never changed or removed from here: refuse before anything queues. */
function loadChangeableTeammate(words: string) {
  return async (input: TeamRefInput): Promise<Result<TeammateState>> => {
    const r = await loadTeammate(input);
    if (r.ok && r.value.target.role === "superadmin") return err("forbidden", `This owner cannot be ${words} from here.`);
    return r;
  };
}

export const teamRoleOp = defineOp<TeamRoleInput, TeammateState>({
  id: "team.role",
  scope: "admin",
  schema: TeamRoleInput,
  load: loadChangeableTeammate("changed"),
  risk: () => "access",
  summary: (input, state) =>
    input.role === "owner" ? `Make ${state.name} an Owner` : `Make ${state.name} part of the Team`,
  subject: (input, state) => ({ type: "user_role", id: input.id, code: state.target.email }),
  run: setTeammateRole,
  revalidate: () => [TEAM_PATH],
});

export const teamRemoveOp = defineOp<TeamRefInput, TeammateState>({
  id: "team.remove",
  scope: "admin",
  schema: TeamRefInput,
  load: loadChangeableTeammate("removed"),
  risk: () => "access",
  summary: (_input, state) => `Remove ${state.name} from the desk`,
  subject: (input, state) => ({ type: "user_role", id: input.id, code: state.target.email }),
  run: removeTeammate,
  revalidate: () => [TEAM_PATH],
});

export const TEAM_OPS: AnyOp[] = [teamInviteOp, teamRoleOp, teamRemoveOp];
