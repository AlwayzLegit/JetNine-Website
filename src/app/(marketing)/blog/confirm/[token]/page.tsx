import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogSubscribers } from "@/db/schema/blog-subscribers";
import { Reveal } from "@/components/reveal";
import { hashToken, isExpired } from "@/lib/watchlist-confirm";
import { BlogConfirmCard } from "../confirm-card";

// Per-token and consent-bearing, so never cached and never indexed. The
// page only reads; the confirmation itself is a POST from the card, so a
// mail scanner following the link cannot opt anyone in.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your subscription · JetNine",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-16 max-md:pt-[140px] max-md:pb-12">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            Blog · weekly digest
          </Reveal>
        </div>
      </header>
      <section className="py-20 max-md:py-14">
        <div className="container-jn">
          <div className="mx-auto max-w-[720px]">{children}</div>
        </div>
      </section>
    </>
  );
}

function Dead({ heading, body }: { heading: string; body: string }) {
  return (
    <Shell>
      <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-10 text-center">
        <h1 className="font-serif text-[26px] font-normal leading-tight text-bone">{heading}</h1>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.55] text-bone-2">{body}</p>
        <Link href="/blog" className="btn btn-primary mt-8">
          Back to the blog <span className="arrow">→</span>
        </Link>
      </div>
    </Shell>
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
    <Shell>
      <BlogConfirmCard token={token} />
    </Shell>
  );
}
