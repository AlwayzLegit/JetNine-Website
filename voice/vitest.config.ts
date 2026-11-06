import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd with the Worker's wrangler.jsonc (nodejs_compat,
// the CallRelay Durable Object). The bindings below override its vars so no
// test talks to a real host; tests can also set src/env.ts `vars` directly.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          PUBLIC_HOST: "voice.example.com",
          TWILIO_AUTH_TOKEN: "test-auth-token",
        },
      },
    }),
  ],
  // The first request into the Worker loads the SDK module graph, which can
  // take several seconds on a cold run.
  test: { include: ["test/**/*.test.ts"], testTimeout: 30_000 },
});
