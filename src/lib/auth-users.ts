import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { asc, eq } from "drizzle-orm";
import { RoleChangeRefused, roleChangeAllowed } from "@/lib/role-lock";

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
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (current && !roleChangeAllowed({ actorRole, currentRole: current.role, nextRole: role })) {
      throw new RoleChangeRefused();
    }
    await tx.execute(sql`select set_config('jn.allow_role_change', '1', true)`);
    await tx.update(users).set({ role, ...extra, updatedAt: new Date() }).where(eq(users.id, userId));
  });
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
  const [row] = await db
    .select({
      id: users.id,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${clean}`)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(1);
  return row ?? null;
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

  const [made] = await db
    .insert(users)
    .values({ email: clean, role: "member", firstName: names.firstName ?? null, lastName: names.lastName ?? null })
    .returning({ id: users.id });

  const oldest = await oldestUserByEmail(clean);
  if (oldest && oldest.id !== made.id) {
    await db.delete(users).where(eq(users.id, made.id));
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
 * or the older bcrypt hash in auth.users (read in place, never returned).
 * An invite mail is sent to anyone who has none, so a failed send can be
 * retried by inviting again.
 */
export async function userHasPassword(userId: string): Promise<boolean> {
  const rows = await db.execute<{ has: boolean }>(sql`
    select (c.user_id is not null or coalesce(a.encrypted_password, '') <> '') as has
    from public.users u
    left join public.user_credentials c on c.user_id = u.id
    left join auth.users a on a.id = u.id
    where u.id = ${userId}
    limit 1
  `);
  return rows[0]?.has === true;
}
