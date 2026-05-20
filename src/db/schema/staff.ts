import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { staffDeskEnum, staffStatusEnum } from "./enums";
import { users } from "./users";

/**
 * Internal staff (dispatchers, admins). One row per user with operational
 * privileges — referenced from quotes, trips, member assignments, etc.
 */
export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  displayName: text("display_name").notNull(),
  desk: staffDeskEnum("desk").notNull().default("float"),
  yearsExperience: integer("years_experience"),
  laneSpecialty: text("lane_specialty"),

  shiftStart: time("shift_start"),
  shiftEnd: time("shift_end"),

  directLineE164: text("direct_line_e164"),
  status: staffStatusEnum("status").notNull().default("off"),
  isLead: boolean("is_lead").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
