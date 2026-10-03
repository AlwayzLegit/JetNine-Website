import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema/members";
import { trips } from "@/db/schema/trips";
import { users } from "@/db/schema/users";
import { logAudit } from "@/lib/audit";
import { auditFields, type Actor } from "@/domain/actor";
import { isUuid } from "@/domain/common";
import { postThreadMessage } from "@/domain/requests/commands";
import { err, ok, type Result } from "@/domain/result";
import type { TripMessageInput } from "./schemas";

/**
 * Trip commands behind the ops in ./ops.ts. Same shape as the request
 * commands: a `load*` for the current rows and a command that runs
 * against them, with no session check or revalidation of its own.
 */

const NOT_FOUND = "No trip with that id.";

export type TripMessageState = {
  trip: { id: string; code: string; memberId: string; memberUserId: string };
  defaultTo: string | null;
  finalTo: string | null;
};

export async function loadTripForMessage(input: TripMessageInput): Promise<Result<TripMessageState>> {
  if (!isUuid(input.id)) return err("not_found", NOT_FOUND);
  // A trip always has a client; the joins also give the default address.
  const [t] = await db
    .select({
      id: trips.id,
      code: trips.tripCode,
      memberId: trips.memberId,
      memberUserId: members.userId,
      memberEmail: users.email,
      memberPhone: users.phoneE164,
    })
    .from(trips)
    .innerJoin(members, eq(members.id, trips.memberId))
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(trips.id, input.id))
    .limit(1);
  if (!t) return err("not_found", NOT_FOUND);

  const c = input.channel;
  const defaultTo = c === "email" ? t.memberEmail : c === "sms" || c === "call" || c === "voicemail" ? t.memberPhone : null;

  return ok({
    trip: { id: t.id, code: t.code, memberId: t.memberId, memberUserId: t.memberUserId },
    defaultTo,
    finalTo: input.toAddress ?? defaultTo,
  });
}

export async function postTripMessage(
  actor: Actor,
  input: TripMessageInput,
  state: TripMessageState,
): Promise<Result<{ id: string }>> {
  const { trip } = state;
  const posted = await postThreadMessage({
    subjectType: "trip",
    subjectId: trip.id,
    code: trip.code,
    channel: input.channel,
    body: input.body,
    toAddress: state.finalTo,
    toUserId: trip.memberUserId,
    fromUserId: actor.userId,
  });
  if (!posted.ok) return posted;

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "trip.message.post",
    subjectType: "trip",
    subjectId: trip.id,
    subjectCode: trip.code,
    metadata: {
      ...a.metadata,
      messageId: posted.value.messageId,
      channel: input.channel,
      toAddress: state.finalTo,
      bodyLen: input.body.length,
      delivery: posted.value.delivery,
    },
  });

  return ok({ id: posted.value.messageId });
}
