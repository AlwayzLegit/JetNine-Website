import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { getPublishedPosts } from "@/lib/blog";
import { readingMinutes } from "@/lib/markdown";

// Blog index — DB-backed, so rendered per-request (same contract as every
// DB-touching route; see the comment in src/db/index.ts).
export const dynamic = "force-dynamic";

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

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export default async function BlogIndexPage() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const posts = await getPublishedPosts();

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

  return (
    <>
      <script
        type="application/ld+json"
        // Stringified desk-authored post metadata from our own DB.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />

      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-20 max-md:pt-[140px] max-md:pb-14">
        <div className="container-jn">
          <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="block h-px w-8 bg-clearance" />
            The blog · notes from the desk
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
            What the desk is seeing.
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            Pricing moves, route intel, aircraft picks, and the occasional strong opinion —
            written between calls, with the numbers left in.
          </Reveal>
        </div>
      </header>

      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          {posts.length === 0 ? (
            <Reveal>
              <p className="max-w-[60ch] text-[16px] leading-[1.6] text-bone-2">
                First posts are on the way. Until then, the{" "}
                <Link href="/guides" className="text-clearance underline underline-offset-4">
                  pricing guide
                </Link>{" "}
                and{" "}
                <Link href="/questions" className="text-clearance underline underline-offset-4">
                  question hub
                </Link>{" "}
                cover most of what people call about.
              </p>
            </Reveal>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p, i) => (
                <Reveal key={p.slug} className={i === 0 ? "md:col-span-2 lg:col-span-3" : ""}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className={`group block ${i === 0 ? "grid grid-cols-1 items-end gap-8 lg:grid-cols-[3fr_2fr]" : ""}`}
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden rounded-[2px] bg-ink-3">
                      {p.heroImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.heroImageUrl}
                          alt={p.heroImageAlt ?? p.title}
                          loading={i === 0 ? "eager" : "lazy"}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>
                    <div className={i === 0 ? "" : "mt-5"}>
                      <p className="caption mb-3">
                        {p.tags[0] ?? "Notes from the desk"}
                        {p.publishedAt ? ` · ${dateFmt.format(p.publishedAt)}` : ""}
                        {` · ${readingMinutes(p.bodyMd)} min read`}
                      </p>
                      <h2
                        className={`font-serif font-normal leading-[1.2] tracking-tight text-bone transition-colors group-hover:text-clearance ${
                          i === 0 ? "text-[34px] max-md:text-[24px]" : "text-[22px]"
                        }`}
                      >
                        {p.title}
                      </h2>
                      <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-bone-2">
                        {p.description}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <QuoteLauncher
        context="blog-index"
        heading="Reading about pricing? Run yours."
        body="Route, date, and passenger count — the wizard prices it live against current market rates."
      />

      <ClosingCTA
        heading="The desk that writes these picks up."
        body="Average pick-up under twenty seconds, every hour of every day. Ask about anything you read here."
      />
    </>
  );
}
