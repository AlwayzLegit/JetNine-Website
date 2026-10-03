import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import { clientSeesChannel, messagePreview, messageSummary } from "@/domain/requests/ops";
import { loadTripForMessage, postTripMessage, type TripMessageState } from "./commands";
import { TripMessageInput } from "./schemas";

/** Operations on trips. Same risk rule as requests: anything the client sees asks first. */

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

export const TRIP_OPS: AnyOp[] = [tripMessageOp];
