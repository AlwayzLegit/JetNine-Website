import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  emptyLegs,
  emptyLegWatchlists,
  emptyLegWatchlistMatches,
} from "@/db/schema/empty-legs";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import {
  channelsFor,
  emailBody,
  emailSubject,
  rejectionFor,
  smsBody,
  type MatchChannel,
  type MatchableLeg,
  type MatchableWatchlist,
} from "@/lib/watchlist-matching";

// Empty-leg watchlist matcher.
//
// Runs on the Vercel cron declared in vercel.json (*/15), which is what
// makes the board's "we match it against the live board every fifteen
// minutes" true. Matching rules live in src/lib/watchlist-matching.ts;
// this route is plumbing.
//
// Delivery is claim-then-send: a `pending` row in
// empty_leg_watchlist_matches is inserted first, and the send only
// happens if that insert won the unique index on
// (watchlist, leg, channel). An overlapping run, a retry after a
// timeout, or a redeploy mid-flight therefore cannot text the same
// person about the same leg twice. The cost of the ordering is that a
// crash between claim and send leaves a `pending` row that is never
// retried — deliberate, because a missed alert is better than a
// duplicate one, and the row records that it happened.
//
// Sending ships dark: sendSms and sendEmail fall through to a logger
// when TWILIO_* / the mail provider env is unset, so this is safe to
// deploy before the Twilio number and A2P registration exist.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// A ceiling so a bad match rule or a bulk leg import can never turn into
// a thousand text messages. Anything above this is a bug worth seeing in
// the response before it reaches customers.
const MAX_SENDS_PER_RUN = 100;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed. Without a secret configured this endpoint would let
  // anyone on the internet trigger customer messaging.
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

async function loadLiveLegs(now: Date): Promise<MatchableLeg[]> {
  return db
    .select({
      id: emptyLegs.id,
      code: emptyLegs.code,
      category: emptyLegs.category,
      fromIcao: emptyLegs.fromIcao,
      fromIata: emptyLegs.fromIata,
      fromCity: emptyLegs.fromCity,
      fromName: emptyLegs.fromName,
      toIcao: emptyLegs.toIcao,
      toIata: emptyLegs.toIata,
      toCity: emptyLegs.toCity,
      toName: emptyLegs.toName,
      wheelsUpAt: emptyLegs.wheelsUpAt,
      listedPriceUsd: emptyLegs.listedPriceUsd,
      fullCharterRefUsd: emptyLegs.fullCharterRefUsd,
      discountPct: emptyLegs.discountPct,
    })
    .from(emptyLegs)
    // Same visibility rule as the public board, plus "has not departed".
    .where(and(eq(emptyLegs.status, "live"), gt(emptyLegs.wheelsUpAt, now)))
    .orderBy(asc(emptyLegs.wheelsUpAt));
}

async function loadActiveWatchlists(): Promise<MatchableWatchlist[]> {
  return db
    .select({
      id: emptyLegWatchlists.id,
      email: emptyLegWatchlists.email,
      phoneE164: emptyLegWatchlists.phoneE164,
      fromIcao: emptyLegWatchlists.fromIcao,
      fromText: emptyLegWatchlists.fromText,
      toIcao: emptyLegWatchlists.toIcao,
      toText: emptyLegWatchlists.toText,
      earliestOn: emptyLegWatchlists.earliestOn,
      latestOn: emptyLegWatchlists.latestOn,
      minDiscountPct: emptyLegWatchlists.minDiscountPct,
      notifyChannels: emptyLegWatchlists.notifyChannels,
      active: emptyLegWatchlists.active,
    })
    .from(emptyLegWatchlists)
    .where(eq(emptyLegWatchlists.active, true));
}

type SendOutcome = {
  ok: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
};

async function deliver(
  channel: MatchChannel,
  watchlist: MatchableWatchlist,
  leg: MatchableLeg,
  siteUrl: string,
): Promise<SendOutcome> {
  if (channel === "sms") {
    const res = await sendSms({ to: watchlist.phoneE164!, body: smsBody(leg, siteUrl) });
    return res.ok
      ? { ok: true, provider: res.provider, messageId: res.messageId }
      : { ok: false, error: res.error };
  }
  const { html, text } = emailBody(leg, siteUrl);
  const res = await sendEmail({
    to: watchlist.email!,
    subject: emailSubject(leg),
    html,
    text,
  });
  return res.ok
    ? { ok: true, provider: res.provider, messageId: res.messageId }
    : { ok: false, error: res.error };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  let legs: MatchableLeg[];
  let watchlists: MatchableWatchlist[];
  try {
    [legs, watchlists] = await Promise.all([loadLiveLegs(now), loadActiveWatchlists()]);
  } catch (err) {
    console.error("[watchlist-cron] load failed", err);
    return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 503 });
  }

  if (legs.length === 0 || watchlists.length === 0) {
    return NextResponse.json({
      ok: true,
      legs: legs.length,
      watchlists: watchlists.length,
      matched: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
  }

  // Pairs worth attempting, cheapest filter first.
  const pending: { w: MatchableWatchlist; leg: MatchableLeg; channel: MatchChannel }[] = [];
  for (const w of watchlists) {
    const channels = channelsFor(w);
    if (channels.length === 0) continue;
    for (const leg of legs) {
      if (rejectionFor(w, leg, now) !== null) continue;
      for (const channel of channels) pending.push({ w, leg, channel });
    }
  }

  const matchedPairs = new Set(pending.map((p) => `${p.w.id}:${p.leg.id}`)).size;

  // Everything already in the ledger for these legs, in one query. The
  // claim insert below is still the authority — it is what closes the
  // race between overlapping runs — but without this pre-filter a steady
  // state of "nothing new to send" would cost one round trip per pair
  // every fifteen minutes, and a backlog of a few thousand pairs would
  // run the function out of time before reaching the new ones.
  const alreadyNotified = new Set<string>();
  try {
    const rows = await db
      .select({
        watchlistId: emptyLegWatchlistMatches.watchlistId,
        legId: emptyLegWatchlistMatches.legId,
        channel: emptyLegWatchlistMatches.channel,
      })
      .from(emptyLegWatchlistMatches)
      .where(
        inArray(
          emptyLegWatchlistMatches.legId,
          legs.map((l) => l.id),
        ),
      );
    for (const r of rows) alreadyNotified.add(`${r.watchlistId}:${r.legId}:${r.channel}`);
  } catch (err) {
    // Fall through with an empty set: the claim insert still prevents
    // duplicates, this run is just slower.
    console.error("[watchlist-cron] ledger preload failed", err);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0; // already notified on a previous run
  let capped = false;

  for (const { w, leg, channel } of pending) {
    if (alreadyNotified.has(`${w.id}:${leg.id}:${channel}`)) {
      skipped++;
      continue;
    }
    if (sent + failed >= MAX_SENDS_PER_RUN) {
      capped = true;
      break;
    }

    // Claim the send. Losing this insert means another run already has
    // it, so there is nothing to do.
    let claimId: string | undefined;
    try {
      const claimed = await db
        .insert(emptyLegWatchlistMatches)
        .values({ watchlistId: w.id, legId: leg.id, channel, status: "pending" })
        .onConflictDoNothing()
        .returning({ id: emptyLegWatchlistMatches.id });
      claimId = claimed[0]?.id;
    } catch (err) {
      console.error("[watchlist-cron] claim failed", { watchlist: w.id, leg: leg.code, err });
      failed++;
      continue;
    }
    if (!claimId) {
      skipped++;
      continue;
    }

    const outcome = await deliver(channel, w, leg, siteUrl);
    if (outcome.ok) sent++;
    else failed++;

    try {
      await db
        .update(emptyLegWatchlistMatches)
        .set({
          status: outcome.ok ? "sent" : "failed",
          provider: outcome.provider ?? null,
          providerMessageId: outcome.messageId ?? null,
          error: outcome.error?.slice(0, 500) ?? null,
          sentAt: new Date(),
        })
        .where(eq(emptyLegWatchlistMatches.id, claimId));
    } catch (err) {
      // The message went out; only the bookkeeping failed. Log loudly —
      // the row stays `pending`, which blocks a duplicate rather than
      // causing one.
      console.error("[watchlist-cron] status write failed", { claimId, err });
    }
  }

  if (sent > 0 || failed > 0) {
    try {
      await logAudit({
        actorUserId: null,
        actorRole: "system",
        action: "empty_leg_watchlist.match.notify",
        subjectType: "empty_leg_watchlist",
        subjectId: null,
        metadata: { legs: legs.length, watchlists: watchlists.length, sent, failed, skipped },
      });
    } catch {
      // Audit must never fail the run.
    }
  }

  return NextResponse.json({
    ok: true,
    legs: legs.length,
    watchlists: watchlists.length,
    matched: matchedPairs,
    sent,
    skipped,
    failed,
    ...(capped ? { capped: MAX_SENDS_PER_RUN } : {}),
  });
}
