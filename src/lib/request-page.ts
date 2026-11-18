import { quoteStore } from "@/domain/quotes/store";
import { STATUS_TOKEN_RE } from "@/lib/request-status";

// Everything the "Your request" page needs for one quote, loaded by its
// status token. Operator cost, markup and dispatcher notes never leave
// the server — only the client price and the plain-words facts.

export type RequestStage = "received" | "options" | "chosen" | "booked" | "closed";

export type RequestLeg = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  distanceNm: number | null;
};

export type RequestOption = {
  id: string;
  optionNumber: number;
  aircraftType: string | null;
  category: string | null;
  paxCapacity: number | null;
  yearOfMake: number | null;
  totalFlightTimeMin: number | null;
  clientPriceUsd: number;
  softHoldExpiry: Date | null;
  isChosen: boolean;
  status: string;
};

export type RequestTripLeg = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  scheduledDepAt: Date | null;
  scheduledArrAt: Date | null;
};

export type RequestView = {
  id: string;
  code: string;
  token: string;
  status: string;
  stage: RequestStage;
  tripType: "one_way" | "round" | "multi_leg";
  paxCount: number;
  notes: string | null;
  firstName: string | null;
  email: string | null;
  phoneE164: string | null;
  receivedAt: Date;
  respondedAt: Date | null;
  acceptedAt: Date | null;
  legs: RequestLeg[];
  options: RequestOption[];
  chosen: RequestOption | null;
  dispatcher: { displayName: string; directLineE164: string | null } | null;
  trip: {
    code: string;
    status: string;
    aircraft: string | null;
    legs: RequestTripLeg[];
  } | null;
};

export function stageFor(status: string, hasOptions: boolean, hasTrip: boolean): RequestStage {
  switch (status) {
    case "submitted":
    case "triaged":
    case "sourcing":
      return "received";
    case "options_sent":
    case "held":
      return hasOptions ? "options" : "received";
    case "accepted":
      return "chosen";
    case "converted":
      return hasTrip ? "booked" : "chosen";
    default:
      return "closed";
  }
}

export async function loadRequestByToken(token: string): Promise<RequestView | null> {
  if (!STATUS_TOKEN_RE.test(token)) return null;

  // The rows come through the quote store (OPS-153); the view is built here.
  const rows = await quoteStore().loadRequestRows(token);
  if (!rows) return null;
  const { quote: q, legs, options: optionRows, dispatcher } = rows;

  // Only options dispatch actually sent (or the one the client picked)
  // are visible; drafts and rejected ones stay internal.
  const options: RequestOption[] = optionRows
    .filter(
      (o) =>
        o.clientPriceUsd != null &&
        (o.status === "sent_to_client" || o.status === "accepted" || o.isChosen),
    )
    .map((o) => ({ ...o, clientPriceUsd: o.clientPriceUsd as number }));
  const chosen = options.find((o) => o.isChosen) ?? null;

  let trip: RequestView["trip"] = null;
  if (rows.trip) {
    trip = {
      code: rows.trip.code,
      status: rows.trip.status,
      aircraft: rows.trip.aircraftMakeModel ?? chosen?.aircraftType ?? null,
      legs: rows.trip.legs,
    };
  }

  return {
    id: q.id,
    code: q.code,
    token,
    status: q.status,
    stage: stageFor(q.status, options.length > 0, trip != null),
    tripType: q.tripType,
    paxCount: q.paxCount,
    notes: q.notes,
    firstName: q.contactSnapshot?.firstName?.trim() || null,
    email: q.contactSnapshot?.email ?? null,
    phoneE164: q.contactSnapshot?.phoneE164 ?? null,
    receivedAt: q.receivedAt,
    respondedAt: q.respondedAt,
    acceptedAt: q.acceptedAt,
    legs,
    options,
    chosen,
    dispatcher,
    trip,
  };
}

// Pure formatters live in request-format.ts (safe for client components).
export * from "./request-format";
