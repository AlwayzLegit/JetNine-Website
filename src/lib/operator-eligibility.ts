import { aircraftCategoryEnum } from "@/db/schema/enums";
import type { AircraftCategorySlug } from "@/lib/fleet";

// DB aircraft-category values (note: DB uses `ulr`, the app/pricing side
// uses `ultra` — see `dbCategoryToSlug`/`normalizeCategory` below).
export type AircraftCategoryDb = (typeof aircraftCategoryEnum.enumValues)[number];

// Operator statuses that disqualify a seller from being sourced onto a live
// quote. `suspended`/`banned` are hard vetting failures; `hold` is a
// commercial/operational pause. This is the single source of truth behind
// the /admin/operators promise that suspended operators are excluded from
// sourcing — use `SOURCING_INELIGIBLE_STATUSES` in `notInArray(...)` filters
// and `isSourcingEligible()` for per-row decisions.
export const SOURCING_INELIGIBLE_STATUSES = ["suspended", "banned", "hold"] as const;

type EligibilityInput = {
  status: string;
  insuranceRenewsOn?: string | null;
  nextAuditOn?: string | null;
};

export type Eligibility = {
  eligible: boolean;
  reason?: string; // set when NOT eligible (hard block)
  warning?: string; // set when eligible-but-screen (soft flag)
};

/**
 * Single predicate for "can this operator be sourced onto a quote?" Hard-
 * fails suspended/banned/hold; allows-but-warns on a lapsed insurance or
 * overdue audit so the dispatcher screens before sending to the client.
 */
export function isSourcingEligible(op: EligibilityInput): Eligibility {
  if ((SOURCING_INELIGIBLE_STATUSES as readonly string[]).includes(op.status)) {
    return { eligible: false, reason: `Operator is ${op.status.replace(/_/g, " ")}` };
  }
  const today = new Date();
  const lapsed: string[] = [];
  if (op.insuranceRenewsOn && new Date(op.insuranceRenewsOn) < today) lapsed.push("insurance");
  if (op.nextAuditOn && new Date(op.nextAuditOn) < today) lapsed.push("audit");
  if (lapsed.length > 0) {
    return { eligible: true, warning: `Lapsed ${lapsed.join(" + ")} — screen before send` };
  }
  return { eligible: true };
}

// ─── Category normalization (Avinode / free-text → DB enum) ────────────────

const CATEGORY_ALIASES: Record<string, AircraftCategoryDb> = {
  turboprop: "turboprop",
  "turbo prop": "turboprop",
  tbm: "turboprop",
  vlj: "light",
  "very light": "light",
  "very light jet": "light",
  light: "light",
  "light jet": "light",
  midsize: "midsize",
  "mid size": "midsize",
  mid: "midsize",
  "midsize jet": "midsize",
  supermid: "supermid",
  "super mid": "supermid",
  "super-mid": "supermid",
  "super midsize": "supermid",
  "super-midsize": "supermid",
  heavy: "heavy",
  "heavy jet": "heavy",
  ulr: "ulr",
  ultra: "ulr",
  "ultra long range": "ulr",
  "ultra-long-range": "ulr",
  "long range": "ulr",
  "long-range": "ulr",
};

/** Map an Avinode/free-text category label to the DB enum, or null. */
export function normalizeCategory(raw: string | null | undefined): AircraftCategoryDb | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key in CATEGORY_ALIASES) return CATEGORY_ALIASES[key];
  // Loose contains-match fallback (e.g. "Super Midsize Jet").
  for (const [alias, cat] of Object.entries(CATEGORY_ALIASES)) {
    if (alias.length >= 4 && key.includes(alias)) return cat;
  }
  return null;
}

/** DB category enum (`ulr`) → app/pricing slug (`ultra`). */
export function dbCategoryToSlug(cat: AircraftCategoryDb): AircraftCategorySlug {
  return cat === "ulr" ? "ultra" : (cat as AircraftCategorySlug);
}
