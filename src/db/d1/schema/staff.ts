// D1 (SQLite) twin of src/db/schema/staff.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { staffDeskEnum, staffStatusEnum } from "../../schema/enums";
import { users } from "./users";

/**
 * Internal staff (dispatchers, admins). One row per user with operational
 * privileges — referenced from quotes, trips, member assignments, etc.
 */
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey().$defaultFn(newId),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  displayName: text("display_name").notNull(),
  desk: text("desk", { enum: staffDeskEnum.enumValues }).notNull().default("float"),
  yearsExperience: integer("years_experience"),
  laneSpecialty: text("lane_specialty"),

  shiftStart: text("shift_start"),
  shiftEnd: text("shift_end"),

  directLineE164: text("direct_line_e164"),
  status: text("status", { enum: staffStatusEnum.enumValues }).notNull().default("off"),
  isLead: integer("is_lead", { mode: "boolean" }).notNull().default(false),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate).$onUpdate(nowDate),
},
  (t) => [
    enumCheck("staff_desk_enum", t.desk, staffDeskEnum.enumValues),
    enumCheck("staff_status_enum", t.status, staffStatusEnum.enumValues),
  ]
);

