"use server";

import { sessionActor } from "@/domain/actor";
import { emptyLegCreateOp, emptyLegStatusOp } from "@/domain/empty-legs/ops";
import { isEmptyLegStatus, type EmptyLegCreateInput } from "@/domain/empty-legs/schemas";
import { runOp } from "@/domain/ops/registry";

export type CreateEmptyLegResult =
  | { ok: true; code: string; id: string }
  | { ok: false; error: string };

const PENDING = "This was sent for approval.";

/**
 * Post an empty leg from the new-leg form. The form-shape checks (blank
 * fields, an unparseable date) stay here with their wording; the rest of
 * the validation, the insert and the audit row are the "emptyLeg.create"
 * op (src/domain/empty-legs), shared with the API and the approval
 * queue. runOp revalidates the admin list and the public board.
 */
export async function createEmptyLeg(formData: FormData): Promise<CreateEmptyLegResult> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  const text = (name: string) => ((formData.get(name) as string | null) ?? "").trim();
  const tail = text("aircraftTail").toUpperCase();
  const fromIcao = text("fromIcao").toUpperCase();
  const toIcao = text("toIcao").toUpperCase();

  if (!tail) return { ok: false, error: "Aircraft tail required" };
  if (!fromIcao || !toIcao) return { ok: false, error: "ICAO codes required" };

  const wheelsUpAtRaw = (formData.get("wheelsUpAt") as string | null)?.trim();
  if (!wheelsUpAtRaw) return { ok: false, error: "Wheels-up time required" };
  const wheelsUpAt = new Date(wheelsUpAtRaw);
  if (Number.isNaN(wheelsUpAt.getTime())) return { ok: false, error: "Invalid wheels-up date" };

  // Anything that is not a known status posts as a draft, as the form always did.
  const statusRaw = (formData.get("status") as string | null) ?? "draft";
  const status = isEmptyLegStatus(statusRaw) ? statusRaw : "draft";

  const input: EmptyLegCreateInput = {
    aircraftTail: tail,
    fromIcao,
    fromIata: text("fromIata").toUpperCase(),
    fromCity: (formData.get("fromCity") as string | null)?.trim() ?? null,
    toIcao,
    toIata: text("toIata").toUpperCase(),
    toCity: (formData.get("toCity") as string | null)?.trim() ?? null,
    wheelsUpAt: wheelsUpAt.toISOString(),
    seats: Number(formData.get("seats") ?? 0),
    fullCharterRefUsd: Number(formData.get("fullCharterRefUsd") ?? 0),
    listedPriceUsd: Number(formData.get("listedPriceUsd") ?? 0),
    status,
    flightMinutes: Number(formData.get("flightMinutes") ?? 0) || null,
    distanceNm: Number(formData.get("distanceNm") ?? 0) || null,
    autoPriceDecay: formData.get("autoPriceDecay") === "on",
    minDiscountPct: Number(formData.get("minDiscountPct") ?? 30),
    petFriendly: formData.get("petFriendly") === "on",
    headline: (formData.get("headline") as string | null) || null,
    bodyCopy: (formData.get("bodyCopy") as string | null) || null,
    visibility: {
      publicBoard: formData.get("visPublic") === "on",
      memberMatch: formData.get("visMemberMatch") === "on",
      weeklyDigest: formData.get("visWeekly") === "on",
    },
  };

  const r = await runOp(emptyLegCreateOp, session.value, input);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  const { id, code } = r.value.value as { id: string; code: string };
  return { ok: true, id, code };
}

// ─── updateEmptyLegStatus ─────────────────────────────────────────
// Status drives public visibility (the board only lists 'live'), so this
// is also the unlist control. The work itself is the "emptyLeg.status" op
// (src/domain/empty-legs), shared with the API and the approval queue.

export async function updateEmptyLegStatus(
  legId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await sessionActor();
  if (!session.ok) return { ok: false, error: session.error };

  if (!/^[0-9a-f-]{36}$/i.test(legId)) return { ok: false, error: "Bad leg id" };
  if (!isEmptyLegStatus(status)) return { ok: false, error: "Invalid status" };

  const r = await runOp(emptyLegStatusOp, session.value, { id: legId, status });
  // The status is checked above, so a schema failure can only be the id.
  if (!r.ok) return { ok: false, error: r.code === "invalid" ? "Bad leg id" : r.error };
  if (r.value.kind === "pending") return { ok: false, error: PENDING };
  return { ok: true };
}
