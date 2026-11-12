import postgres from "postgres";
import { env } from "cloudflare:workers";

// Postgres through the HYPERDRIVE binding (the same Hyperdrive config the
// site uses, pointed at Supabase's session pooler). The voice tables used
// to be read through Supabase's REST API with the service-role key; when
// that API was switched off for an egress overrun the phone went quiet
// while the database itself was fine. Hyperdrive talks to Postgres
// directly, so the agent now depends on nothing but the database.
//
// Workers may not share a socket between requests, and a Durable Object
// runs for the length of a call, so every operation opens its own
// short-lived client and closes it again. Hyperdrive sits in the same data
// centre and keeps the real connections pooled, which makes that cheap.

export type Sql = ReturnType<typeof postgres>;

type Hyperdrive = { connectionString: string };

// Only the binding's presence is checked here. Reading its connection
// string counts as I/O, which the runtime forbids while the module loads
// (config.ts asks at that point), so that happens inside withDb.
const hyperdrive = (): Hyperdrive | undefined => (env as unknown as { HYPERDRIVE?: Hyperdrive }).HYPERDRIVE;

/** True when the Worker has a database to talk to. */
export const dbConfigured = (): boolean => hyperdrive() !== undefined;

/** Runs `fn` with a client that is closed when it returns. */
export async function withDb<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const hd = hyperdrive();
  if (!hd) throw new Error("Database is not configured (HYPERDRIVE binding)");
  const sql = postgres(hd.connectionString, {
    max: 1,
    // A per-operation client gains nothing from prepared statements.
    // Parameters go to Postgres untyped (the library's default), so enum,
    // jsonb and date columns take plain strings.
    prepare: false,
    connect_timeout: 10,
  });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
