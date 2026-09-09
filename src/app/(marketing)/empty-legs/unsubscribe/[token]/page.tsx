import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emptyLegWatchlists } from "@/db/schema/empty-legs";
import { Reveal } from "@/components/reveal";
import { UnsubscribeCard } from "../unsubscribe-card";

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

  let row;
  try {
    [row] = await db
      .select({
        fromText: emptyLegWatchlists.fromText,
        toText: emptyLegWatchlists.toText,
        smsConfirmedAt: emptyLegWatchlists.smsConfirmedAt,
      })
      .from(emptyLegWatchlists)
      .where(eq(emptyLegWatchlists.unsubscribeToken, token))
      .limit(1);
  } catch (err) {
    console.error("[watchlist-unsubscribe] lookup failed", err);
  }

  return (
    <>
      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-16 max-md:pt-[140px] max-md:pb-12">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            Empty legs · watchlist
          </Reveal>
        </div>
      </header>
      <section className="py-20 max-md:py-14">
        <div className="container-jn">
          <div className="mx-auto max-w-[720px]">
            {row ? (
              <UnsubscribeCard
                token={token}
                route={`${row.fromText?.toUpperCase() ?? "—"} → ${row.toText?.toUpperCase() ?? "—"}`}
                hasSms={Boolean(row.smsConfirmedAt)}
              />
            ) : (
              <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
                <h1 className="font-serif text-[26px] font-normal leading-tight text-bone">
                  Nothing to stop here.
                </h1>
                <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">
                  This watchlist has already been removed, or the link is not one of ours.
                  Either way you will not hear from us about it.
                </p>
                <Link href="/empty-legs" className="btn btn-primary mt-8">
                  Back to the board <span className="arrow">→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
