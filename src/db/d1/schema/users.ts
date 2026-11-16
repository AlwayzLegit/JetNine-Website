// D1 (SQLite) twin of src/db/schema/users.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { userRoleEnum } from "../../schema/enums";

/**
 * D1 has no `auth` schema, so id is a plain text primary key with no foreign
 * key. Since OPS-94 the Postgres id has no foreign key either and a default of
 * gen_random_uuid(), and the site makes a user row itself (invites), so the D1
 * id gets a default too.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(newId),

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
    .$defaultFn(nowDate).$onUpdate(nowDate),
},
  (t) => [
    enumCheck("users_role_enum", t.role, userRoleEnum.enumValues),
  ]
);

