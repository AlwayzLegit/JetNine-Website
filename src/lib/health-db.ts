// The db check when the deployment uses D1 (OPS-176). Kept apart from health.ts so it can be
// tested with plain functions and no database.
//
// Before the cutover, `ok` of the db check came from Postgres only, even on staging where
// DB_TARGET is d1, so a broken D1 would have read healthy and a dead Supabase would have read
// unhealthy. The check now judges the database the deployment actually uses: when the target is
// d1, `ok` and `latencyMs` come from `select 1` on the D1 binding, and Postgres is reported as
// information only (`postgres: "ok" | "error" | "skipped"`) and never changes `ok`.
//
// Nothing here prints a message from the database: an error is shown as its name only.

export type DbCheck = { ok: boolean } & Record<string, unknown>;

export type JudgeD1Deps = {
  /** True when the D1 binding exists on this deployment. */
  d1Present: boolean;
  /** `select 1` on the D1 binding; rejects when D1 does not answer. */
  d1Ping: () => Promise<unknown>;
  /** `select 1` on Postgres; rejects when it does not answer. Informational only. */
  pgPing: () => Promise<unknown>;
  /** Extra informational fields (the D1 table count), added as they are. */
  info?: Record<string, unknown>;
  /** Time limit for each ping, in ms. */
  timeoutMs?: number;
  now?: () => number;
  log?: (line: string, data: Record<string, unknown>) => void;
};

export const DB_PING_TIMEOUT_MS = 3000;

class PingTimeout extends Error {
  constructor() {
    super("timeout");
    this.name = "PingTimeout";
  }
}

async function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      p,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new PingTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const errName = (err: unknown): string => (err instanceof Error && err.name ? err.name : "unknown");

export async function judgeD1(deps: JudgeD1Deps): Promise<DbCheck> {
  const now = deps.now ?? (() => performance.now());
  const ms = deps.timeoutMs ?? DB_PING_TIMEOUT_MS;
  const log = deps.log ?? ((line, data) => console.error(line, data));

  // Postgres is looked at for information only; it never changes ok. The call runs inside a promise
  // chain so a synchronous throw (no DATABASE_URL, no Hyperdrive) is also just postgres: "error".
  const postgres: "ok" | "error" = await withTimeout(Promise.resolve().then(() => deps.pgPing()), ms).then(
    () => "ok" as const,
    () => "error" as const,
  );
  const info = deps.info ?? {};

  if (!deps.d1Present) {
    return { ok: false, error: "d1 binding absent", target: "d1", postgres, ...info };
  }
  const t0 = now();
  try {
    await withTimeout(deps.d1Ping(), ms);
    return { ok: true, latencyMs: Math.round(now() - t0), target: "d1", postgres, ...info };
  } catch (err) {
    log("[health] d1 db probe failed", { name: errName(err) });
    return { ok: false, latencyMs: Math.round(now() - t0), error: errName(err), target: "d1", postgres, ...info };
  }
}
