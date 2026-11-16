// D1 (SQLite) twin of src/db/schema/users.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumCheck, nowDate } from "../helpers";
import { userRoleEnum } from "../../schema/enums";

/**
 * D1 has no `auth` schema (Supabase Auth owns it on Postgres), so id is a plain
 * text primary key with no foreign key. Who creates a user row is OPS-91's and
 * OPS-94's job.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),

  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  preferredName: text("preferred_name"),
  phoneE164: text("phone_e164"),

  role: text("role", { enum: userRoleEnum.enumValues }).notNull().default("member"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(nowDate),
},
  (t) => [
    enumCheck("users_role_enum", t.role, userRoleEnum.enumValues),
  ]
);

