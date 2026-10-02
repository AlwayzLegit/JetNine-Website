import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiRequests } from "@/db/schema/api";

// Daily API housekeeping (vercel.json: "20 9 * * *" UTC). Prunes the
// per-call request log after 30 days. Keys themselves are never deleted:
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
  return NextResponse.json({ ok: true, pruned: pruned.length });
}
