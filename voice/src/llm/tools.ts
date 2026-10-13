import type Anthropic from "@anthropic-ai/sdk";
import {
  activeTrips,
  lookupCaller,
  saveMessage,
  upsertLead,
  upsertTripRequest,
} from "../db/queries.js";

// Tool definitions (what Claude sees) and handlers (what runs). Handlers
// receive the live call session so partial leads persist as they arrive.

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "save_lead",
    description:
      "Save or update the caller's charter lead. Call it as soon as you learn ANY field and again whenever a new field arrives; every call merges into the same lead and trip for this call. Partial information is expected.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Caller's name as given" },
        callback_number: { type: "string", description: "Best callback number; default to caller ID once confirmed" },
        email: { type: "string" },
        origin: { type: "string", description: "Departure city or airport as spoken" },
        destination: { type: "string", description: "Arrival city or airport as spoken" },
        depart_date: { type: "string", description: "Departure date/time as spoken, e.g. 'next Friday around 6pm'" },
        depart_date_iso: { type: "string", description: "Best-effort ISO date YYYY-MM-DD for the departure, if determinable" },
        return_date: { type: "string", description: "Return date as spoken, if round trip" },
        return_date_iso: { type: "string", description: "Best-effort ISO date YYYY-MM-DD for the return" },
        trip_type: { type: "string", enum: ["one_way", "round_trip"] },
        pax: { type: "integer", description: "Passenger count" },
        urgency: {
          type: "string",
          enum: ["within_48h", "this_week", "flexible", "unknown"],
          description: "within_48h when departure is inside forty-eight hours from now",
        },
        notes: { type: "string", description: "Anything else useful for the broker: pets, luggage, preferences, timing constraints" },
        callback_time: {
          type: "string",
          description: "When the caller would like a broker to call them back, as spoken, e.g. 'today after three PM' or 'as soon as possible'",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "save_message",
    description:
      "Record a message for a call that is not a charter inquiry: vendors, operators, press, job seekers, or anything else. Capture who they are and what they need.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        company: { type: "string" },
        reason: { type: "string", description: "What they are calling about, in one or two sentences" },
        callback: { type: "string", description: "Callback number or email" },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  {
    name: "escalate",
    description:
      "Warm-transfer the caller to the on-call broker right now. Use for departures within forty-eight hours, any request for a human, existing clients with an active trip, in-progress flight or safety matters, or when you are failing to help. Say one short handoff sentence to the caller BEFORE calling this.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["departure_within_48h", "caller_requested_human", "existing_client_active_trip", "agent_failing", "in_progress_flight_or_safety", "other"],
        },
        summary: { type: "string", description: "One line for the broker: who is calling and what they need" },
      },
      required: ["reason", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "lookup_caller",
    description: "Look up prior lead and trip context for a phone number. Rarely needed: the caller ID lookup already ran before the call started.",
    input_schema: {
      type: "object",
      properties: { phone: { type: "string", description: "E.164 phone number" } },
      required: ["phone"],
      additionalProperties: false,
    },
  },
  {
    name: "end_call",
    description: "Say goodbye first, then call this to hang up gracefully once the conversation is complete.",
    input_schema: {
      type: "object",
      properties: { summary: { type: "string", description: "One-line summary of the call for the log" } },
      required: ["summary"],
      additionalProperties: false,
    },
  },
];

export type ToolContext = {
  callId: string;
  callerNumber: string;
  leadId: string | null;
  tripId: string | null;
  /** Set by handlers; the session acts on these after the turn. */
  requestedEscalation: { reason: string; summary: string } | null;
  requestedEnd: { summary: string } | null;
  outcomeHint: "lead" | "message" | null;
  /**
   * No-transfer mode: the team's phones already rang for this call (ring-
   * first) and nobody took it, so the agent must never hand it back. The
   * escalate tool refuses; the agent takes details and arranges a callback.
   */
  noTransfer?: boolean;
  /**
   * The agent's transfer switches (Settings › Voice agent › Call handling).
   * Absent = every reason allowed unless noTransfer.
   */
  canTransfer?: (reason: string) => boolean;
};

function transferOk(ctx: ToolContext, reason: string): boolean {
  if (ctx.noTransfer) return false;
  return ctx.canTransfer ? ctx.canTransfer(reason) : true;
}

/**
 * A callback number as heard → E.164, or why it can't be one. US numbers
 * need exactly ten digits (or eleven starting with 1); a leading + keeps an
 * international number of 8 to 15 digits.
 */
export function checkCallbackNumber(raw: string): { ok: true; e164: string } | { ok: false; digits: number } {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0") ? { ok: true, e164: `+${digits}` } : { ok: false, digits: digits.length };
  }
  if (digits.length === 10) return { ok: true, e164: `+1${digits}` };
  if (digits.length === 11 && digits.startsWith("1")) return { ok: true, e164: `+${digits}` };
  return { ok: false, digits: digits.length };
}

const HOURS_48 = 48 * 60 * 60 * 1000;

export function withinFortyEightHours(iso: string | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  // Treat the whole departure day as inside the window if it ends within 48h.
  return t + 24 * 60 * 60 * 1000 - Date.now() <= HOURS_48;
}

export async function runTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<{ result: string; isError?: boolean }> {
  const input = (rawInput ?? {}) as Record<string, string | number | undefined>;
  try {
    switch (name) {
      case "save_lead": {
        // A short or long number is never saved: the caller is asked again.
        let badNumber: number | null = null;
        // An existing lead keeps its number unless a valid new one arrives.
        let phone = ctx.leadId ? "" : ctx.callerNumber;
        if (input.callback_number) {
          const checked = checkCallbackNumber(String(input.callback_number));
          if (checked.ok) phone = checked.e164;
          else badNumber = checked.digits;
        }
        ctx.leadId = await upsertLead({
          leadId: ctx.leadId,
          phone,
          name: input.name as string | undefined,
          email: input.email as string | undefined,
        });
        const departIso = input.depart_date_iso as string | undefined;
        const hot = input.urgency === "within_48h" || withinFortyEightHours(departIso);
        ctx.tripId = await upsertTripRequest({
          tripId: ctx.tripId,
          leadId: ctx.leadId,
          callId: ctx.callId,
          fields: {
            origin: input.origin as string | undefined,
            destination: input.destination as string | undefined,
            depart_date: input.depart_date as string | undefined,
            depart_date_iso: departIso ?? null,
            return_date: input.return_date as string | undefined,
            return_date_iso: (input.return_date_iso as string | undefined) ?? null,
            trip_type: input.trip_type as string | undefined,
            pax: input.pax as number | undefined,
            urgency: hot ? "within_48h" : (input.urgency as string | undefined),
            notes:
              [input.notes, input.callback_time ? `Preferred callback: ${input.callback_time}` : undefined]
                .filter(Boolean)
                .join(" · ") || undefined,
          },
        });
        ctx.outcomeHint = "lead";
        const numberNote =
          badNumber === null
            ? ""
            : ` The callback number was NOT saved: you heard ${badNumber} digits and a US number has ten. Tell the caller you missed a digit and ask for the number again, slowly, then read it back in groups of three, three and four.`;
        return {
          result:
            (hot
              ? transferOk(ctx, "departure_within_48h")
                ? "Saved. HOT LEAD: departure is within forty-eight hours. Tell the caller you are connecting them to the on-call broker and call escalate now."
                : "Saved. HOT LEAD: departure is within forty-eight hours. Do not transfer. Finish gathering the trip details and the best callback number, ask when they would like the call, tell them a broker will call them back as a priority, then wrap up."
              : "Saved. Continue gathering any missing fields, one question at a time.") + numberNote,
        };
      }
      case "save_message": {
        await saveMessage({
          callId: ctx.callId,
          name: input.name as string | undefined,
          company: input.company as string | undefined,
          reason: String(input.reason ?? ""),
          callback: (input.callback as string | undefined) ?? ctx.callerNumber,
        });
        ctx.outcomeHint = ctx.outcomeHint ?? "message";
        return { result: "Message saved. Let the caller know the team will follow up, then wrap up." };
      }
      case "escalate": {
        if (!transferOk(ctx, String(input.reason ?? "other"))) {
          return {
            result:
              "Transfers are not available on this call. Do not mention a transfer. Help the caller yourself: save their details, offer a broker callback and ask when suits them, then wrap up.",
            isError: true,
          };
        }
        ctx.requestedEscalation = {
          reason: String(input.reason ?? "other"),
          summary: String(input.summary ?? ""),
        };
        return { result: "Transfer is starting. Do not say anything further." };
      }
      case "lookup_caller": {
        const { lead, trips } = await lookupCaller(String(input.phone ?? ctx.callerNumber));
        if (!lead) return { result: "No prior lead for that number." };
        const active = activeTrips(trips);
        return {
          result: JSON.stringify({
            name: lead.name,
            email: lead.email,
            active_trips: active.map((t) => ({
              route: `${t.origin ?? "?"} to ${t.destination ?? "?"}`,
              departs: t.depart_date,
              status: t.status,
            })),
          }),
        };
      }
      case "end_call": {
        ctx.requestedEnd = { summary: String(input.summary ?? "") };
        return { result: "Ending the call." };
      }
      default:
        return { result: `Unknown tool ${name}`, isError: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { result: `Tool ${name} failed: ${msg}. Continue the conversation; do not mention the error.`, isError: true };
  }
}
