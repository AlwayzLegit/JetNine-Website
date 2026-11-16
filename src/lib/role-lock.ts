// Who may change a user's role (OPS-102). The Postgres trigger
// users_enforce_role_immutable (migration 0001, relaxed in 0050) refused a role
// change unless the caller was an admin or the transaction carried the flag
// set by setUserRole. D1 cannot run that trigger, so the app enforces the same
// rule at the command boundary (OWASP ASVS V4, access control on the server).
// The trigger stays in place while production is on Postgres.

export const ROLE_ADMINS: readonly string[] = ["admin", "superadmin"];

export class RoleChangeRefused extends Error {
  constructor() {
    super("role can only be changed by admins");
    this.name = "RoleChangeRefused";
  }
}

/** The role stays as it is, or an admin changes it. Nobody else does. */
export function roleChangeAllowed(input: { actorRole: string | null | undefined; currentRole: string; nextRole: string }): boolean {
  if (input.nextRole === input.currentRole) return true;
  return input.actorRole != null && ROLE_ADMINS.includes(input.actorRole);
}
