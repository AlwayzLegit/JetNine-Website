import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userRoleEnum } from "./enums";

/**
 * public.users holds the app-level identity fields. Rows made before
 * migration 0057 share their id with a Supabase auth.users row (a trigger on
 * auth.users inserted them). Since 0057 the id has no foreign key and gets
 * its own default, so the site can create a user itself (invites, OPS-94).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

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
    .default(sql`now()`).$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
