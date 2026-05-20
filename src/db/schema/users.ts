import { sql } from "drizzle-orm";
import { pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userRoleEnum } from "./enums";

/**
 * Supabase manages auth.users. We reference it for foreign keys but never
 * write to it directly — Supabase Auth owns the lifecycle.
 */
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

/**
 * public.users extends auth.users with app-level identity fields. One row
 * per auth user. Inserted by a trigger on auth.users (see RLS migration).
 */
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),

  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  preferredName: text("preferred_name"),
  phoneE164: text("phone_e164"),

  role: userRoleEnum("role").notNull().default("member"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
