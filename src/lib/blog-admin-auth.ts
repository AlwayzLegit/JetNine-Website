import { timingSafeEqual } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";

// Two ways into the blog admin API, checked in order:
//
//   1. `Authorization: Bearer <BLOG_ADMIN_API_KEY>` — for programmatic
//      posting (content pipelines, this desk's own tooling). If the env
//      var is unset the bearer path is disabled entirely, so a fresh
//      deploy can never be written to with an empty-string token.
//   2. A signed-in Supabase session whose users.role is admin/superadmin —
//      same gate as requireAdmin, but returning 401 instead of redirecting
//      (this is an API, not a page).

export type BlogAdminIdentity =
  | { kind: "api-key" }
  | { kind: "session"; userId: string; email: string };

export async function authorizeBlogAdmin(
  req: Request,
): Promise<BlogAdminIdentity | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const key = process.env.BLOG_ADMIN_API_KEY;
    if (!key) return null;
    const provided = Buffer.from(header.slice(7));
    const expected = Buffer.from(key);
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return { kind: "api-key" };
    }
    return null;
  }

  const user = await getCurrentUser();
  if (user && ["admin", "superadmin"].includes(user.role)) {
    return { kind: "session", userId: user.id, email: user.email };
  }
  return null;
}
