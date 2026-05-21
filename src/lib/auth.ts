import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users, type User } from "@/db/schema/users";
import { eq } from "drizzle-orm";

export type CurrentUser = {
  id: string;
  email: string;
  role: User["role"];
  firstName: string | null;
  lastName: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, user.id));

  return row ?? null;
}

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return user;
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!["dispatcher", "admin", "superadmin"].includes(user.role)) {
    redirect("/account?denied=admin");
  }
  return user;
}

/**
 * Stricter gate than requireStaff — dispatchers are excluded. Use for actions
 * that mutate reference data (airports, fbos), seed operations, and
 * permissions changes, matching the RLS contract (`is_admin()` on those
 * tables).
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!["admin", "superadmin"].includes(user.role)) {
    redirect("/account?denied=admin");
  }
  return user;
}
