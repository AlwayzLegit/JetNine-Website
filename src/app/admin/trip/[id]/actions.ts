"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripStatusEnum } from "@/db/schema/trips";
import { requireStaff } from "@/lib/auth";

type Status = (typeof tripStatusEnum.enumValues)[number];

function isStatus(v: string): v is Status {
  return (tripStatusEnum.enumValues as readonly string[]).includes(v);
}

export async function updateTripStatus(
  tripId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff();
  if (!isStatus(status)) return { ok: false, error: "Invalid status" };

  const patch: Partial<typeof trips.$inferInsert> = { status };
  // Stamp wheels timestamps as a convenience when the dispatcher moves the
  // trip across the obvious milestones.
  const now = new Date();
  if (status === "airborne") patch.wheelsUpAt = now;
  if (status === "wheels_down" || status === "completed") patch.wheelsDownAt = now;

  await db.update(trips).set(patch).where(eq(trips.id, tripId));

  revalidatePath("/admin/trip");
  revalidatePath(`/admin/trip/${tripId}`);
  revalidatePath("/account/trips");
  return { ok: true };
}
