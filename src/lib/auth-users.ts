import type { users } from "@/db/schema/users";
import { identityStore } from "@/lib/identity-store/store";

/**
 * The id of the public.users row for an email (oldest first), or null.
 * Replaces the lookup in auth.users: since OPS-94 the site's own row is the
 * account, with or without a Supabase auth user behind it.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const row = await oldestUserByEmail(email.trim().toLowerCase());
  return row?.id ?? null;
}

/**
 * Change a user's role from a Server Action. The role-immutability trigger
 * (migration 0001, relaxed in 0050) only lets this through when the
 * transaction-local flag is set, so the update and the flag share one
 * transaction. The caller has already run requireAdmin().
 *
 * The app also enforces the rule itself (OPS-102, src/lib/role-lock.ts), so it
 * holds on a database with no triggers: a role change by anyone but an admin
 * throws RoleChangeRefused. The trigger stays while production is on Postgres.
 */
export async function setUserRole(
  actorRole: string | null | undefined,
  userId: string,
  role: typeof users.$inferSelect.role,
  extra: Partial<Pick<typeof users.$inferInsert, "firstName" | "lastName">> = {},
): Promise<void> {
  await identityStore().setRoleGuarded(actorRole, userId, role, extra);
}

export type UserForInvite = {
  id: string;
  role: typeof users.$inferSelect.role;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
  /** True when this call made the row. */
  created: boolean;
};

async function oldestUserByEmail(clean: string) {
  return identityStore().oldestUserByEmail(clean);
}

/**
 * The public.users row for an invite (OPS-94): the oldest row for this
 * email, or a new one made here. This is the work the trigger
 * handle_new_auth_user used to do after Supabase Auth made the account: the
 * row is a plain member (an invite never makes an admin) with the typed
 * names. No Supabase call, no waiting for a trigger.
 *
 * There is no unique index on lower(email), so after an insert the oldest
 * row is read again: if another request made one first, this call's row is
 * removed and the older one is used.
 */
export async function findOrCreateUser(
  email: string,
  names: { firstName?: string | null; lastName?: string | null } = {},
): Promise<UserForInvite> {
  const clean = email.trim().toLowerCase();
  const hit = await oldestUserByEmail(clean);
  if (hit) return { ...hit, created: false };

  const store = identityStore();
  const made = await store.insertUser({ email: clean, firstName: names.firstName ?? null, lastName: names.lastName ?? null });

  const oldest = await oldestUserByEmail(clean);
  if (oldest && oldest.id !== made.id) {
    await store.deleteUser(made.id);
    return { ...oldest, created: false };
  }
  return {
    id: made.id,
    role: "member",
    firstName: names.firstName ?? null,
    lastName: names.lastName ?? null,
    phoneE164: null,
    created: true,
  };
}

/**
 * Whether this user can sign in with a password: a row in user_credentials,
 * or (Postgres only) the older bcrypt hash in auth.users (read in place, never returned).
 * An invite mail is sent to anyone who has none, so a failed send can be
 * retried by inviting again.
 */
export async function userHasPassword(userId: string): Promise<boolean> {
  return identityStore().hasPassword(userId);
}
