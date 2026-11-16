import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/session";

export type CurrentUser = SessionUser;

/** Who is signed in, from the site's own session (src/lib/session). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return getSessionUser();
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
