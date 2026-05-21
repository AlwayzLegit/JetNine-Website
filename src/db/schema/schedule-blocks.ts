import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { aircraft } from "./aircraft";
import { trips } from "./trips";
import { quotes } from "./quotes";
import { users } from "./users";

/**
 * Anything that takes an aircraft off the line for a window of time —
 * confirmed trips, scheduled maintenance, repositioning, crew rest,
 * owner-private use, soft holds during sourcing, generic unavailable.
 *
 * Trips already live in their own table; we mirror them into this view via
 * kind='trip' + related_trip_id so the fleet planner can render trips and
 * non-trip blocks against the same time axis without a UNION ALL on every
 * query.
 *
 * Soft holds (kind='hold') are TTL-based and may legitimately overlap with
 * other holds — different dispatchers can soft-hold the same airframe for
 * different quotes simultaneously. The dispatcher resolves overlap by
 * upgrading one hold to a confirmed trip block.
 */

export const scheduleBlockKindEnum = pgEnum("schedule_block_kind", [
  "trip",
  "maintenance",
  "repositioning",
  "crew_rest",
  "owner",
  "hold",
  "unavailable",
]);

export const aircraftScheduleBlocks = pgTable(
  "aircraft_schedule_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),

    kind: scheduleBlockKindEnum("kind").notNull(),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),

    // When kind='trip', link the source row so promoting / cancelling a
    // trip lets us upsert / clear the block atomically.
    relatedTripId: uuid("related_trip_id").references(() => trips.id, {
      onDelete: "cascade",
    }),

    // When kind='hold', point at the originating quote so soft holds can be
    // surfaced on the workbench and TTL-expired holds vacuumed cleanly.
    relatedQuoteId: uuid("related_quote_id").references(() => quotes.id, {
      onDelete: "cascade",
    }),

    // Useful for trip/repositioning blocks. Free text so we don't FK to
    // airports yet (that table arrives in Phase B.2.airports).
    fromIcao: text("from_icao"),
    toIcao: text("to_icao"),

    // Free-form crew list for now. When staff.crew lands we can FK these.
    crewIds: jsonb("crew_ids").$type<string[] | null>(),

    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // Primary range query — "what's on this tail between dates X and Y".
    index("asb_aircraft_window_idx").on(t.aircraftId, t.startAt, t.endAt),
    index("asb_kind_idx").on(t.kind),
    index("asb_window_idx").on(t.startAt, t.endAt),
    index("asb_related_trip_idx").on(t.relatedTripId),
    index("asb_related_quote_idx").on(t.relatedQuoteId),
  ],
);

export type AircraftScheduleBlock = typeof aircraftScheduleBlocks.$inferSelect;
export type NewAircraftScheduleBlock = typeof aircraftScheduleBlocks.$inferInsert;
