import { sql } from "@/db";

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

/**
 * Postgres-backed fixed-window rate limiter. Counts hits per (bucket,
 * window_start) tuple; rejects once `max` is reached. Survives cold starts
 * on serverless and doesn't require Redis/KV.
 *
 * Window granularity is `windowSeconds` — windows are aligned to epoch so
 * the same key in two different lambdas converges on the same bucket row.
 *
 * Failures (DB down, table missing, etc.) are treated as ALLOW so a
 * misbehaving rate-limiter never blocks legitimate traffic.
 */
export async function checkRateLimit(
  bucket: string,
  options: { max: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const { max, windowSeconds } = options;
  const nowMs = Date.now();
  const windowStartMs = Math.floor(nowMs / (windowSeconds * 1000)) * windowSeconds * 1000;
  const windowStart = new Date(windowStartMs);

  try {
    const rows = await sql<{ hits: number }[]>`
      insert into public.request_rate_limits (bucket, window_start, hits)
      values (${bucket}, ${windowStart}, 1)
      on conflict (bucket, window_start)
      do update set hits = public.request_rate_limits.hits + 1
      returning hits
    `;
    const hits = rows[0]?.hits ?? 1;
    // First hit of a fresh window: piggyback a best-effort prune so the
    // table can't grow unbounded. Nothing else calls pruneRateLimits.
    if (hits === 1) void pruneRateLimits();
    if (hits > max) {
      const retryAfterMs = windowStartMs + windowSeconds * 1000 - nowMs;
      return { ok: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }
    return { ok: true, remaining: Math.max(max - hits, 0) };
  } catch (err) {
    // Lead with name+message so log pipelines that truncate long lines
    // (Vercel's table view) still show the cause, not just the prefix.
    // Production has logged this failure on every submit since launch
    // with the cause cut off — see the rate-limit investigation in #31.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[rate-limit] check failed (failing open) — ${detail} — bucket=${bucket}`);
    // TEMP diagnostic (remove once the prod cause is identified): every
    // log surface truncates the message, but DB writes succeed right
    // after this first failed query — so persist the full error where it
    // can be read back without truncation. Best-effort; never throws.
    try {
      const stack = err instanceof Error ? (err.stack ?? "").slice(0, 1500) : null;
      await sql`
        insert into public.audit_log (actor_role, action, subject_type, metadata)
        values ('system', 'rate_limit.diagnostic', 'contact_inquiry',
                ${JSON.stringify({ detail, stack, bucket })}::jsonb)
      `;
    } catch {
      // Diagnostic write is best-effort only.
    }
    return { ok: true, remaining: max };
  }
}

/**
 * Best-effort cleanup of expired window rows. Call on a cron or inside a
 * write path occasionally; safe to ignore.
 */
export async function pruneRateLimits(olderThanSeconds = 3600): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    await sql`delete from public.request_rate_limits where window_start < ${cutoff}`;
  } catch (err) {
    console.error("[rate-limit] prune failed", err);
  }
}
