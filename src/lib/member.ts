import type { Member } from "@/db/schema/members";
import { memberStore } from "@/domain/members/store";

/**
 * Looks up the member row tied to a given user id. Returns null if the user
 * signed in but never had a member profile created. Account pages call this and
 * fall back to an empty state. Reads through the member store (OPS-149), so it
 * follows the database target.
 */
export async function getMemberByUserId(userId: string): Promise<Member | null> {
  return memberStore().memberByUserId(userId);
}
