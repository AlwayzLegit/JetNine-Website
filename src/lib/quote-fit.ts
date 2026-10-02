import { getFleetEntry, type AircraftCategorySlug } from "@/lib/fleet";

// Does the chosen category fit the mission? Same rule the aircraft step
// uses to grey a card out: enough seats for every passenger and enough
// range for the longest leg. Lives outside the client-only quote store so
// the submit Server Action can call it too.
export function categoryFits(
  category: AircraftCategorySlug,
  pax: number,
  legs: { distanceNm?: number }[],
): { ok: true } | { ok: false; reason: "pax" | "range" } {
  const entry = getFleetEntry(category);
  if (!entry) return { ok: false, reason: "pax" };
  if (entry.pax < pax) return { ok: false, reason: "pax" };
  const longest = Math.max(0, ...legs.map((l) => l.distanceNm ?? 0));
  if (entry.rangeNm < longest) return { ok: false, reason: "range" };
  return { ok: true };
}
