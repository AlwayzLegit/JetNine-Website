import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { getPublishedPost } from "@/lib/blog";
import { renderMarkdown, readingMinutes } from "@/lib/markdown";

// Individual blog article — DB-backed, rendered per-request. Drafts and
// unknown slugs 404 so nothing unpublished ever has a public URL.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const html = renderMarkdown(post.bodyMd);
  const minutes = readingMinutes(post.bodyMd);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${siteUrl}/blog/${post.slug}`,
    ...(post.heroImageUrl
      ? {
          image: post.heroImageUrl.startsWith("/")
            ? `${siteUrl}${post.heroImageUrl}`
            : post.heroImageUrl,
        }
      : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: post.author, url: siteUrl },
    publisher: { "@type": "Organization", name: "JetNine", url: siteUrl },
    ...(post.tags.length > 0 ? { keywords: post.tags.join(", ") } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/blog/${post.slug}` },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${siteUrl}/blog/${post.slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Stringified post metadata from our own DB (sanitized on write path).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-16 max-md:pt-[140px] max-md:pb-12">
        <div className="container-jn">
          <Reveal className="mb-6 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <Link href="/blog" className="transition-colors hover:text-clearance">
              ← The blog
            </Link>
            <span className="text-steel">·</span>
            {post.publishedAt ? <span>{dateFmt.format(post.publishedAt)}</span> : null}
            <span className="text-steel">·</span>
            <span>{minutes} min read</span>
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-l max-w-[24ch]">
            {post.title}
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            {post.description}
          </Reveal>
          {post.tags.length > 0 ? (
            <Reveal stagger={3} className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel"
                >
                  — {t}
                </span>
              ))}
            </Reveal>
          ) : null}
        </div>
      </header>

      <article className="py-20 max-md:py-14">
        <div className="container-jn">
          {post.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.heroImageUrl}
              alt={post.heroImageAlt ?? post.title}
              className="mb-14 w-full max-w-[880px] rounded-[2px]"
              loading="eager"
            />
          ) : null}
          <div
            className="blog-prose"
            // Markdown → HTML via src/lib/markdown.ts — sanitize-html strips
            // script/style/event handlers before this ever renders.
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
            — {post.author} · Updated {dateFmt.format(post.updatedAt)}
          </p>
        </div>
      </article>

      <QuoteLauncher
        context="blog-post"
        heading="Put a number on your own trip."
        body="Route, date, and passenger count — the wizard prices it live while the article is still fresh."
      />

      <ClosingCTA
        heading="Questions about what you just read?"
        body="The desk that wrote it picks up in under twenty seconds, every hour of every day."
      />
    </>
  );
}
