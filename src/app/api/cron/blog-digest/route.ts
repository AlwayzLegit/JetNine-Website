import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { blogStore } from "@/domain/blog/store";
import { sendEmail } from "@/lib/email";
import {
  blogDigestEmail,
  blogUnsubscribePageUrl,
  blogUnsubscribePostUrl,
} from "@/lib/blog-subscribe";
import { unsubscribeHeaders } from "@/lib/watchlist-confirm";

// Weekly blog digest — Fridays (wrangler.jsonc cron), one email per confirmed
// subscriber with the posts published in the last 7 days.
//
// Delivery is claim-then-send: the run first stamps last_digest_at on the
// rows it will mail (with the batch cap inside the claim subquery), so an
// overlapping run or a retry after a timeout cannot send the same person
// two digests. A crash between claim and send skips that subscriber for
// the week — deliberate: a missed digest beats a duplicate one.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PER_RUN = 200;
const DIGEST_WINDOW_DAYS = 7;
const MAX_POSTS = 7;
const DIGEST_FLOOR_DAYS = 6;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed — without a secret this endpoint would let anyone on the
  // internet flush a week's digest sends at will.
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const since = new Date(Date.now() - DIGEST_WINDOW_DAYS * 24 * 3600_000);

  const store = blogStore();
  const posts = await store.publishedSince(since, MAX_POSTS);

  if (posts.length === 0) {
    return NextResponse.json({ ok: true, posts: 0, sent: 0 });
  }

  // Claim before sending. The 6-day floor (not 7) keeps a cron that fires
  // slightly early from skipping everyone until next week.
  const now = new Date();
  const claimed = await store.claimDigest(new Date(now.getTime() - DIGEST_FLOOR_DAYS * 24 * 3600_000), MAX_PER_RUN, now);

  let sent = 0;
  let failed = 0;

  for (const sub of claimed) {
    const pageUrl = blogUnsubscribePageUrl(sub.unsubscribeToken);
    const postUrl = blogUnsubscribePostUrl(sub.unsubscribeToken);
    const copy = blogDigestEmail(posts, pageUrl);
    const result = await sendEmail({
      to: sub.email,
      ...copy,
      headers: unsubscribeHeaders(postUrl),
    });
    if (result.ok) sent += 1;
    else {
      failed += 1;
      console.error(`[blog-digest] send failed for subscriber ${sub.id}: ${result.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    posts: posts.length,
    claimed: claimed.length,
    sent,
    failed,
  });
}
