import { defineConfig } from "drizzle-kit";

// The D1 (SQLite) twin of drizzle.config.ts (OPS-100). No credentials: the
// migrations are only generated here and applied by `wrangler d1 migrations
// apply` (the staging deploy workflow does it). Nothing live reads these tables yet.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/d1/schema/*",
  out: "./src/db/d1/migrations",
  strict: true,
  verbose: true,
});
