import type { Metadata } from "next";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { emptyLegWatchlists } from "@/db/schema/empty-legs";
import { hashToken, isExpired } from "@/lib/watchlist-confirm";
import { WatchlistConfirmCard } from "@/components/empty-legs/confirm-card";
import { DeadTokenCard, TokenPageShell } from "@/components/empty-legs/token-page-shell";

// Per-token and consent-bearing, so never cached and never indexed. The
// page only reads; the confirmation itself is a POST from the card, so a
// mail scanner following the link cannot opt anyone in.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your empty-leg alerts · JetNine",
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatWindow(earliest: string | null, latest: string | null): string {
  if (!earliest && !latest) return "any dates";
  const fmt = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));
  if (earliest && latest) return `${fmt(earliest)} – ${fmt(latest)}`;
  return earliest ? `from ${fmt(earliest)}` : `until ${fmt(latest!)}`;
}

const TITLE = "Confirm your alerts.";
const LEAD = "One click and the watchlist goes live. Nothing is sent until then.";

function Dead({ heading, body }: { heading: string; body: string }) {
  return (
    <TokenPageShell title={TITLE}>
      <DeadTokenCard heading={heading} body={body} />
    </TokenPageShell>
  );
}

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let row;
  try {
    const hash = hashToken(token);
    [row] = await db
      .select({
        fromText: emptyLegWatchlists.fromText,
        toText: emptyLegWatchlists.toText,
        earliestOn: emptyLegWatchlists.earliestOn,
        latestOn: emptyLegWatchlists.latestOn,
        expiresAt: emptyLegWatchlists.confirmExpiresAt,
      })
      .from(emptyLegWatchlists)
      .where(
        or(
          eq(emptyLegWatchlists.confirmSmsTokenHash, hash),
          eq(emptyLegWatchlists.confirmEmailTokenHash, hash),
        ),
      )
      .limit(1);
  } catch (err) {
    console.error("[watchlist-confirm] lookup failed", err);
    return (
      <Dead
        heading="We couldn't check that link."
        body="Something went wrong at our end. Try the link again in a minute, or call the desk and we'll set the watchlist up for you."
      />
    );
  }

  // Already used, never existed, or swept after expiry — all the same
  // from here, and deliberately not distinguished: a probe should not
  // learn whether a token was ever real.
  if (!row) {
    return (
      <Dead
        heading="This link is no longer valid."
        body="It may already have been used, or the request expired. Setting the watchlist up again takes a few seconds."
      />
    );
  }

  if (isExpired(row.expiresAt)) {
    return (
      <Dead
        heading="This link has expired."
        body="Confirmation links last 48 hours. Set the watchlist up again and we'll send a fresh one."
      />
    );
  }

  return (
    <TokenPageShell title={TITLE} lead={LEAD}>
      <WatchlistConfirmCard
        token={token}
        route={`${row.fromText ?? "—"} → ${row.toText ?? "—"}`}
        window={formatWindow(row.earliestOn, row.latestOn)}
      />
    </TokenPageShell>
  );
}
