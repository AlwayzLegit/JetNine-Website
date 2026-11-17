import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd with the Worker's wrangler.jsonc (nodejs_compat,
// the CallRelay Durable Object). The bindings below override its vars so no
// test talks to a real host; tests can also set src/env.ts `vars` directly.
//
// The HYPERDRIVE binding needs a local Postgres URL to exist at all. Point
// it at a closed port unless the developer supplies a real local database:
// every query then fails fast and the code's no-database paths are what
// gets tested.
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??=
  "postgresql://placeholder:placeholder@127.0.0.1:1/placeholder";

// A D1 database binding DB for the store's D1 side (OPS-137). It holds the
// site's own D1 migrations (src/db/d1/migrations, the ones the staging
// database runs), applied by test/setup-d1.ts. The default target stays
// Postgres, so no other test notices it; test/store-d1.test.ts switches the
// target with vars.DB_TARGET.
const d1Migrations = await readD1Migrations(fileURLToPath(new URL("../src/db/d1/migrations", import.meta.url)));

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        d1Databases: ["DB"],
        bindings: {
          PUBLIC_HOST: "voice.example.com",
          TWILIO_AUTH_TOKEN: "test-auth-token",
          D1_MIGRATIONS: d1Migrations,
        },
      },
    }),
  ],
  // The first request into the Worker loads the SDK module graph, which can
  // take several seconds on a cold run.
  test: { include: ["test/**/*.test.ts"], setupFiles: ["./test/setup-d1.ts"], testTimeout: 30_000 },
});
