import { tripState } from "@/lib/desk-status";
import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import { clientSeesChannel, messagePreview, messageSummary } from "@/domain/requests/ops";
import {
  loadTripForMessage,
  loadTripForStatus,
  postTripMessage,
  setTripStatus,
  tripStatusNotifies,
  tripStatusRefunds,
  type TripMessageState,
  type TripStatusState,
} from "./commands";
import { TripMessageInput, TripStatusInput } from "./schemas";

/**
 * Operations on trips. Same risk rule as requests: anything the client
 * sees asks first; anything that moves money asks an owner.
 */

/** What the client reads when a trip reaches a milestone, in a few words. */
function statusWords(status: string): string {
  switch (status) {
    case "confirmed":
      return "is confirmed";
    case "boarding":
      return "is boarding";
    case "completed":
      return "is complete";
    case "cancelled_wx":
      return "is cancelled because of weather";
    case "cancelled_other":
      return "is cancelled";
    case "diverted":
      return "is landing at a different airport";
    case "irregular_ops":
      return "has changed and a dispatcher is calling";
    default:
      return `is ${tripState(status).label.toLowerCase()}`;
  }
}

export const tripMessageOp = defineOp<TripMessageInput, TripMessageState>({
  id: "trip.message",
  scope: "desk",
  schema: TripMessageInput,
  load: loadTripForMessage,
  risk: (input) => (clientSeesChannel(input.channel) ? "client" : null),
  summary: (input, state) => messageSummary(input.channel, state.finalTo, `trip ${state.trip.code}`),
  preview: (input, state) => messagePreview(state.finalTo, input.body),
  subject: (_input, state) => ({ type: "trip", id: state.trip.id, code: state.trip.code }),
  editable: ["body"],
  run: postTripMessage,
  revalidate: (input) => [`/admin/trips/${input.id}`],
});

export const tripStatusOp = defineOp<TripStatusInput, TripStatusState>({
  id: "trip.status",
  scope: "desk",
  schema: TripStatusInput,
  load: loadTripForStatus,
  // Cancelling refunds reserve draws and card payments; other milestones email/text the client.
  risk: (input, state) => (tripStatusRefunds(input, state) ? "money" : tripStatusNotifies(input, state) ? "client" : null),
  summary: (input, state) => {
    const base = `Mark trip ${state.trip.code} as “${tripState(input.status).label}”`;
    if (tripStatusRefunds(input, state)) return `${base}, which refunds the client`;
    if (tripStatusNotifies(input, state)) return `${base}, which notifies the client`;
    return base;
  },
  preview: (input, state) => {
    if (tripStatusRefunds(input, state)) {
      return `Refunds every reserve draw and card payment on this trip, then emails and texts the client: your trip ${state.trip.code} ${statusWords(input.status)}.`;
    }
    if (tripStatusNotifies(input, state)) {
      return `Email and text to the client: your trip ${state.trip.code} ${statusWords(input.status)}.`;
    }
    return null;
  },
  subject: (_input, state) => ({ type: "trip", id: state.trip.id, code: state.trip.code }),
  run: setTripStatus,
  revalidate: (input) => ["/admin/trips", `/admin/trips/${input.id}`, "/admin/requests", "/account/trips"],
});

export const TRIP_OPS: AnyOp[] = [tripMessageOp, tripStatusOp];
