import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { BlogTabs } from "@/components/blog/blog-tabs";
import { PostCard, PostImage, postMeta } from "@/components/blog/post-card";
import { SubscribeCard } from "@/components/blog/subscribe-card";
import { getPublishedPosts } from "@/lib/blog";
import { GUIDE_CHAPTERS } from "@/lib/guides";
import { RATES_UPDATED } from "@/lib/rates";
import { SITE } from "@/lib/constants";

// Blog index — DB-backed but served from the ISR cache: Next skips font
// preloads (and the CDN skips caching) on force-dynamic pages, so the blog
// templates rendered with a visible font swap. The admin API revalidates
// /blog, /blog/[slug] and the feed on every write, so the hourly window
// only matters for edits made directly in the database.
export const revalidate = 3600;

const base = pageMetadata({
  title: "Private Jet Charter Blog — Notes From the Desk",
  description:
    "Charter pricing moves, route intel, aircraft picks, and the occasional strong opinion — written by the JetNine dispatch desk, with the numbers left in.",
  path: "/blog",
});
export const metadata: Metadata = {
  ...base,
  alternates: { ...base.alternates, types: { "application/rss+xml": "/blog/feed.xml" } },
};

export default async function BlogIndexPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  let posts: Awaited<ReturnType<typeof getPublishedPosts>> = [];
  try {
    posts = await getPublishedPosts();
  } catch {
    // Build-time render without DATABASE_URL (see src/db/index.ts) falls
    // through to the empty state; the first real request fills the cache.
    posts = [];
  }

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "JetNine — notes from the desk",
    url: `${siteUrl}/blog`,
    publisher: { "@type": "Organization", name: "JetNine", url: siteUrl },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${siteUrl}/blog/${p.slug}`,
      ...(p.publishedAt ? { datePublished: p.publishedAt.toISOString() } : {}),
    })),
  };

  const [featured, ...rest] = posts;

  const postsPanel = (
    <>
      <section className="container-jn pt-10">
        {!featured ? (
          <p className="max-w-[60ch] text-bone-2">
            First posts are on the way. Until then, the{" "}
            <Link href="/guides" className="text-link">
              pricing guide
            </Link>{" "}
            and{" "}
            <Link href="/questions" className="text-link">
              question hub
            </Link>{" "}
            cover most of what people call about.
          </p>
        ) : (
          <>
            <Link
              href={`/blog/${featured.slug}`}
              className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[3fr_2fr]"
            >
              <PostImage post={featured} eager />
              <div>
                <p className="label-jn mb-2.5">{postMeta(featured)}</p>
                <h2
                  className="font-serif text-[34px] font-normal leading-[1.15] text-bone max-md:text-[26px]"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {featured.title}
                </h2>
                <p className="mt-3 text-bone-2">{featured.description}</p>
                <span className="mt-3.5 inline-block text-[15px] font-medium text-bone">
                  Read <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
            {rest.length > 0 ? (
              <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <PostCard key={p.slug} post={p} headingLevel="h2" />
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>
      <section className="container-jn pt-20 max-md:pt-14">
        <SubscribeCard />
      </section>
    </>
  );

  const guidesPanel = (
    <section className="container-jn pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="title-section max-w-[20ch] !text-[clamp(32px,4vw,40px)]">
            Charter pricing, with the prices left in.
          </h2>
          <p className="mt-3.5 max-w-[62ch] text-[17px] text-bone-2">
            Most charter guides explain everything about cost except the numbers. This one is
            written by the desk that publishes its rate card: real hourly rates, a real itemized
            quote, and the honest levers that move a price — in the order you&rsquo;d ask.
          </p>
        </div>
        <span className="text-[14px] text-steel">
          Updated {RATES_UPDATED} · rates reviewed quarterly
        </span>
      </div>
      <ol className="card mt-8 overflow-hidden">
        {GUIDE_CHAPTERS.map((c) => (
          <li key={c.slug} className="border-b border-line-faint last:border-b-0">
            <Link
              href={c.href}
              className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 px-7 py-6 transition-colors hover:bg-surface-2 max-md:px-5 md:grid-cols-[72px_minmax(0,1fr)_auto] md:gap-6"
            >
              <span
                className="font-serif text-[36px] font-light leading-none text-clearance"
                aria-hidden="true"
              >
                {String(c.chapter).padStart(2, "0")}
              </span>
              <span>
                <span className="sr-only">Chapter {c.chapter}: </span>
                <span className="block text-[22px] font-medium leading-[1.25] text-bone max-md:text-[19px]">
                  {c.title}
                </span>
                <span className="mt-1.5 block max-w-[70ch] text-[15px] text-bone-2">
                  {c.description}
                </span>
              </span>
              <span className="text-[15px] font-medium text-bone max-md:hidden">
                Read <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[15px] text-bone-2">
        Prefer the number to the reading?{" "}
        <Link href="/quote/mission" className="text-link-strong">
          Price your trip
        </Link>{" "}
        — it runs your route against the same rate card in about ninety seconds. The full guide
        lives at{" "}
        <Link href="/guides" className="text-link">
          /guides
        </Link>
        .
      </p>
    </section>
  );

  return (
    <>
      <script
        type="application/ld+json"
        // Stringified desk-authored post metadata from our own DB.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />

      <PageHero
        eyebrow="The blog · notes from the desk"
        title="What the desk is seeing."
        lead="Pricing moves, route intel, aircraft picks, and the occasional strong opinion — written between calls, with the numbers left in."
        className="!pb-0 [&>div]:!pb-0"
      />

      <BlogTabs
        postsLabel="Notes from the desk"
        guidesLabel={`The pricing guide · ${GUIDE_CHAPTERS.length} chapters`}
        posts={postsPanel}
        guides={guidesPanel}
      />

      <CtaBand
        title="The desk that writes these picks up."
        body="Average pick-up under twenty seconds, every hour of every day. Ask about anything you read here."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
      />
    </>
  );
}
