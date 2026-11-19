// The rehearsal runs only against a throwaway Postgres on the same machine (OPS-198).
// This guard is shared by apply.mjs and copy.mjs, and is called before any connection.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Refuse any DATABASE_URL whose host is not localhost or 127.0.0.1, so the rehearsal can
 * never reach Supabase or any pooler. Returns the parsed host. The URL itself (which can
 * hold a password) is never put in a message.
 * @param {string|undefined} databaseUrl
 */
export function assertLocalDatabase(databaseUrl) {
  if (!databaseUrl) throw new Error("refused: DATABASE_URL is not set");
  let host;
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("refused: DATABASE_URL is not a URL");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error("refused: the rehearsal runs only against localhost or 127.0.0.1");
  }
  return host;
}

/**
 * The rehearsal mode is allowed only with target staging and a local database.
 * @param {{ target?: string, databaseUrl?: string }} a
 */
export function assertRehearse({ target, databaseUrl }) {
  if (target !== "staging") throw new Error(`refused: mode rehearse needs target "staging", got ${JSON.stringify(target)}`);
  assertLocalDatabase(databaseUrl);
}

/**
 * Tables the fixture must fill, so "0 with a difference" is never a pass over empty tables:
 * the users the trigger makes from auth.users, the tables with generated codes (quotes, trips,
 * invoices), a member, a blog post, and api_requests (the identity column).
 */
export const FIXTURE_TABLES = ["users", "members", "quotes", "quote_legs", "trips", "trip_legs", "invoices", "blog_posts", "api_requests", "audit_log"];

/** Names of the FIXTURE_TABLES with no rows in a copy run's results ({ table: { name }, pgCount }). */
export function missingFixtureTables(results) {
  const counts = new Map(results.filter((r) => !r.held).map((r) => [r.table.name, r.pgCount]));
  return FIXTURE_TABLES.filter((t) => !(counts.get(t) > 0));
}
