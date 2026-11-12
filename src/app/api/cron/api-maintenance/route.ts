import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiRequests } from "@/db/schema/api";
import { failStaleRuns } from "@/domain/agent/commands";
import { expirePending } from "@/domain/approvals/commands";
import { pruneSmokeQuotes } from "@/domain/requests/prune-smoke";

// Daily API housekeeping (wrangler.jsonc cron "20 9 * * *" UTC). Prunes the
// per-call request log after 30 days, marks assistant runs left open for
// a day as failed, expires proposals nobody decided within 7 days and
// removes week-old quotes left by the post-deploy smoke suite. Keys themselves are never deleted:
// revoked and expired keys stay listed in Settings › API keys for the record.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "", "utf8");
  const b = Buffer.from(`Bearer ${secret}`, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const pruned = await db
    .delete(apiRequests)
    .where(lt(apiRequests.at, sql`now() - interval '30 days'`))
    .returning({ id: apiRequests.id });
  const staleRuns = await failStaleRuns();
  const expiredApprovals = await expirePending();
  // Last, and never fatal: the housekeeping above must not depend on it.
  let smokeQuotes: number | string;
  try {
    smokeQuotes = await pruneSmokeQuotes();
  } catch (error) {
    console.error("[api-maintenance] smoke quote prune failed", error);
    smokeQuotes = "failed";
  }
  return NextResponse.json({ ok: true, pruned: pruned.length, staleRuns, expiredApprovals, smokeQuotes });
}
