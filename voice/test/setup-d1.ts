import { env } from "cloudflare:workers";

// Runs before every test file: the site's D1 migrations onto the test DB
// binding (vitest.config.ts reads them as statement lists). It uses the
// binding only. Importing "cloudflare:test" here would start the Worker's
// main module before a test file has set its vars, and config.ts reads the
// vars once, when it loads.
type Migration = { name: string; queries: string[] };
const bindings = env as unknown as { DB: D1Database; D1_MIGRATIONS: Migration[] };

const done = await bindings.DB.prepare("select name from sqlite_master where type = 'table' and name = 'voice_calls'").first();
if (!done) {
  for (const migration of bindings.D1_MIGRATIONS) {
    for (const query of migration.queries) await bindings.DB.prepare(query).run();
  }
}
