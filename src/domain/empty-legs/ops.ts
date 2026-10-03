import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import {
  createEmptyLeg,
  goesLive,
  loadEmptyLegForStatus,
  loadForEmptyLegCreate,
  setEmptyLegStatus,
  type EmptyLegCreateState,
  type EmptyLegStatusState,
} from "./commands";
import { EmptyLegCreateInput, EmptyLegStatusInput, type EmptyLegStatus } from "./schemas";

/**
 * Operations on empty legs. The risk rule is "does it reach the public?":
 * a leg that goes live lands on the public board and the watchlist cron
 * texts subscribers about it, so a supervised key's call is queued for a
 * person; drafts and desk-side status changes run at once.
 */

export const EMPTY_LEG_STATUS_WORDS: Record<EmptyLegStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  sold: "Sold",
  cancelled: "Cancelled",
  expired: "Expired",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const PUBLIC_PATHS = ["/admin/empty-leg", "/empty-legs"];

export const emptyLegCreateOp = defineOp<EmptyLegCreateInput, EmptyLegCreateState>({
  id: "emptyLeg.create",
  scope: "desk",
  schema: EmptyLegCreateInput,
  load: loadForEmptyLegCreate,
  risk: (input) => (input.status === "live" ? "client" : null),
  summary: (input, state) => {
    const base = `Post an empty leg ${input.fromIcao} → ${input.toIcao} on ${day.format(state.wheelsUpAt)}`;
    return input.status === "live" ? `${base}, live on the site` : base;
  },
  preview: (input, state) =>
    [
      `${input.fromIcao} → ${input.toIcao}`,
      `Wheels up ${when.format(state.wheelsUpAt)}`,
      `${input.seats} seat${input.seats === 1 ? "" : "s"}`,
      `${usd.format(input.listedPriceUsd)} (full charter ${usd.format(input.fullCharterRefUsd)}, ${state.discountPct}% off)`,
    ].join("\n"),
  // No row yet: the code is assigned by the DB when the leg is inserted.
  subject: () => ({ type: "empty_leg", id: null, code: null }),
  editable: ["headline", "bodyCopy"],
  run: createEmptyLeg,
  revalidate: () => PUBLIC_PATHS,
});

export const emptyLegStatusOp = defineOp<EmptyLegStatusInput, EmptyLegStatusState>({
  id: "emptyLeg.status",
  scope: "desk",
  schema: EmptyLegStatusInput,
  load: loadEmptyLegForStatus,
  risk: (input, state) => (goesLive(input, state) ? "client" : null),
  summary: (input, state) => `Mark empty leg ${state.leg.code} as “${EMPTY_LEG_STATUS_WORDS[input.status]}”`,
  subject: (_input, state) => ({ type: "empty_leg", id: state.leg.id, code: state.leg.code }),
  run: setEmptyLegStatus,
  revalidate: () => PUBLIC_PATHS,
});

export const EMPTY_LEG_OPS: AnyOp[] = [emptyLegCreateOp, emptyLegStatusOp];
