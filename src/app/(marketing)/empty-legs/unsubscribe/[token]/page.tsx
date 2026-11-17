import type { Metadata } from "next";
import { watchlistStore } from "@/domain/empty-legs/watchlist-store";
import { WatchlistUnsubscribeCard } from "@/components/empty-legs/unsubscribe-card";
import { DeadTokenCard, TokenPageShell } from "@/components/empty-legs/token-page-shell";

// Reading only. The unsubscribe itself is a POST from the card, so a
// scanner walking the email cannot unsubscribe the reader — the header
// route next door is the one that acts on a bare POST, which is what
// RFC 8058 asks for.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stop empty-leg alerts · JetNine",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Chosen once, outside the try, so a d1 target without its binding fails loudly.
  const store = watchlistStore();
  let row;
  try {
    row = await store.byUnsubscribeToken(token);
  } catch (err) {
    console.error("[watchlist-unsubscribe] lookup failed", err);
  }

  return (
    <TokenPageShell
      title="Stop your alerts."
      lead="Choose what to stop. The board itself is always here."
    >
      {row ? (
        <WatchlistUnsubscribeCard
          token={token}
          route={`${row.fromText ?? "—"} → ${row.toText ?? "—"}`}
          hasSms={Boolean(row.smsConfirmedAt)}
        />
      ) : (
        <DeadTokenCard
          heading="Nothing to stop here."
          body="This watchlist has already been removed, or the link is not one of ours. Either way you will not hear from us about it."
        />
      )}
    </TokenPageShell>
  );
}
