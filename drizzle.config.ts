import { defineConfig } from "drizzle-kit";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL must be set (see .env.example). Drizzle Kit cannot run without a connection string.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*",
  out: "./src/db/migrations",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
