import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, type Member } from "@/db/schema/members";

/**
 * Looks up the member row tied to a given Supabase user id. Returns null if
 * the user signed in but never had a member profile created. Account pages
 * call this and fall back to an empty state.
 */
export async function getMemberByUserId(userId: string): Promise<Member | null> {
  const [row] = await db.select().from(members).where(eq(members.userId, userId));
  return row ?? null;
}
