import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in.");
}

// One connection pool per process. postgres-js handles pooling internally;
// Supabase pgbouncer prefers transaction-mode (port 6543) with prepare:false.
const sql = postgres(url, {
  prepare: false,
  max: 10,
});

export const db = drizzle(sql);
export { sql };
