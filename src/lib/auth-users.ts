import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";

/**
 * Find an existing Supabase auth user by email. Reads auth.users directly
 * (the site connects on the postgres role), so it does not stop at the
 * first page of the GoTrue admin list the way `listUsers` does.
 */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(
    sql`select id from auth.users where lower(email) = ${email.trim().toLowerCase()} limit 1`,
  );
  return rows[0]?.id ?? null;
}

/**
 * Change a user's role from a Server Action. The role-immutability trigger
 * (migration 0001, relaxed in 0050) only lets this through when the
 * transaction-local flag is set, so the update and the flag share one
 * transaction. The caller has already run requireAdmin().
 */
export async function setUserRole(
  userId: string,
  role: typeof users.$inferSelect.role,
  extra: Partial<Pick<typeof users.$inferInsert, "firstName" | "lastName">> = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('jn.allow_role_change', '1', true)`);
    await tx.update(users).set({ role, ...extra, updatedAt: new Date() }).where(eq(users.id, userId));
  });
}
