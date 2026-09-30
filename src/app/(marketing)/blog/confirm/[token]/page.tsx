import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogSubscribers } from "@/db/schema/blog-subscribers";
import { hashToken, isExpired } from "@/lib/watchlist-confirm";
import { BlogConfirmCard } from "@/components/blog/confirm-card";
import { BlogDeadTokenCard, BlogTokenPageShell } from "@/components/blog/token-page-shell";

// Per-token and consent-bearing, so never cached and never indexed. The
// page only reads; the confirmation itself is a POST from the card, so a
// mail scanner following the link cannot opt anyone in.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your subscription · JetNine",
  robots: { index: false, follow: false },
};

const TITLE = "Confirm your subscription.";
const LEAD = "One click and the Friday digest starts. Nothing is sent until then.";

function Dead({ heading, body }: { heading: string; body: string }) {
  return (
    <BlogTokenPageShell title={TITLE}>
      <BlogDeadTokenCard heading={heading} body={body} />
    </BlogTokenPageShell>
  );
}

export default async function BlogConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let row;
  try {
    const hash = hashToken(token);
    [row] = await db
      .select({ expiresAt: blogSubscribers.confirmExpiresAt })
      .from(blogSubscribers)
      .where(eq(blogSubscribers.confirmTokenHash, hash))
      .limit(1);
  } catch (err) {
    console.error("[blog-confirm] page lookup failed", err);
    return (
      <Dead
        heading="We couldn't check that link."
        body="Something went wrong at our end. Try the link again in a minute."
      />
    );
  }

  // Already used, never existed, or expired-and-reissued — deliberately
  // not distinguished, so a probe learns nothing about real tokens.
  if (!row) {
    return (
      <Dead
        heading="This link is no longer valid."
        body="It may already have been used, or the request expired. Subscribing again takes a few seconds."
      />
    );
  }

  if (isExpired(row.expiresAt)) {
    return (
      <Dead
        heading="This link has expired."
        body="Confirmation links last 48 hours. Subscribe again and we'll send a fresh one."
      />
    );
  }

  return (
    <BlogTokenPageShell title={TITLE} lead={LEAD}>
      <BlogConfirmCard token={token} />
    </BlogTokenPageShell>
  );
}
