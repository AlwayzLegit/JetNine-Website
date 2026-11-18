// D1 (SQLite) twin of src/db/schema/schedule-blocks.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { scheduleBlockKindEnum } from "../../schema/schedule-blocks";
import { aircraft } from "./aircraft";
import { airports } from "./airports";
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


export const aircraftScheduleBlocks = sqliteTable(
  "aircraft_schedule_blocks",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    aircraftId: text("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),

    kind: text("kind", { enum: scheduleBlockKindEnum.enumValues }).notNull(),

    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),

    // When kind='trip', link the source row so promoting / cancelling a
    // trip lets us upsert / clear the block atomically.
    relatedTripId: text("related_trip_id").references(() => trips.id, {
      onDelete: "cascade",
    }),

    // When kind='hold', point at the originating quote so soft holds can be
    // surfaced on the workbench and TTL-expired holds vacuumed cleanly.
    relatedQuoteId: text("related_quote_id").references(() => quotes.id, {
      onDelete: "cascade",
    }),

    // Useful for trip/repositioning blocks.
    fromIcao: text("from_icao").references(() => airports.icao, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    toIcao: text("to_icao").references(() => airports.icao, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

    // Free-form crew list for now. When staff.crew lands we can FK these.
    crewIds: text("crew_ids", { mode: "json" }).$type<string[] | null>(),

    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [
    // Primary range query — "what's on this tail between dates X and Y".
    index("asb_aircraft_window_idx").on(t.aircraftId, t.startAt, t.endAt),
    index("asb_kind_idx").on(t.kind),
    index("asb_window_idx").on(t.startAt, t.endAt),
    index("asb_related_trip_idx").on(t.relatedTripId),
    index("asb_related_quote_idx").on(t.relatedQuoteId),
    index("asb_from_icao_idx").on(t.fromIcao),
    index("asb_to_icao_idx").on(t.toIcao),
    // Migration 0032 (Postgres), carried over by OPS-149: one soft hold per (aircraft, quote).
    uniqueIndex("schedule_blocks_hold_per_quote_aircraft_uniq")
      .on(t.aircraftId, t.relatedQuoteId)
      .where(sql`${t.kind} = 'hold' and ${t.relatedQuoteId} is not null`),
    enumCheck("aircraft_schedule_blocks_kind_enum", t.kind, scheduleBlockKindEnum.enumValues),
  ]);

