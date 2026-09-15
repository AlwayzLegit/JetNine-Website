import { NextResponse } from "next/server";
import { unsubscribeBlogByToken } from "@/lib/blog-subscribe";

// RFC 8058 one-click unsubscribe for the blog digest. The
// List-Unsubscribe header on every digest points here, and Gmail and
// Yahoo POST to it when someone uses their client's own unsubscribe
// button. Same contract as the watchlist route next door: POST only, no
// confirmation step, always 200 for unknown tokens (a prober must not
// learn which are real), 503 only on a genuine failure so the provider
// retries.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await unsubscribeBlogByToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
