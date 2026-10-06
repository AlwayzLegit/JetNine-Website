import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/page-meta";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { PlanBox } from "@/components/light/plan-box";
import { JournalCtaStrip } from "@/components/blog/journal-cta";
import { PostCard, postDateFmt } from "@/components/blog/post-card";
import { PostFaq } from "@/components/blog/post-faq";
import { getPublishedPost, getPublishedPosts, getRelatedPosts } from "@/lib/blog";
import { SubscribeCard } from "@/components/blog/subscribe-card";
import { renderMarkdown, readingMinutes, extractToc } from "@/lib/markdown";

// Individual blog article — DB-backed, cached via ISR (see the note in
// ../page.tsx: force-dynamic drops font preloads). Drafts and unknown
// slugs 404 so nothing unpublished ever has a public URL; the admin API
// revalidates the slug on every write so publishing is immediate.
//
// Anatomy (top to bottom, Light - Journal grammar): split paper hero with
// the post image, TOC rail / prose / plan box, FAQ (FAQPage JSON-LD),
// related posts, digest signup, slim navy closing strip.
export const revalidate = 3600;
// Without generateStaticParams a dynamic segment is rendered on demand on
// every request and the revalidate window never applies (the Vercel build
// table lists it as dynamic). Seed the published slugs at build; anything
// newer renders on first request and is cached under the same window.
export const dynamicParams = true;
export async function generateStaticParams() {
  try {
    const posts = await getPublishedPosts();
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    // No DATABASE_URL at build (see src/db/index.ts): every slug renders on
    // its first request instead.
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    ...(post.heroImageUrl
      ? { image: post.heroImageUrl, imageAlt: post.heroImageAlt ?? post.title }
      : {}),
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  const html = renderMarkdown(post.bodyMd);
  const toc = extractToc(html);
  const minutes = readingMinutes(post.bodyMd);
  const related = await getRelatedPosts(post, 3);
  const heroAbs = post.heroImageUrl
    ? post.heroImageUrl.startsWith("/")
      ? `${siteUrl}${post.heroImageUrl}`
      : post.heroImageUrl
    : null;
  const category = post.tags[0] ?? "Notes from the desk";
  const eyebrow = [
    category,
    post.publishedAt ? postDateFmt.format(post.publishedAt) : null,
    `${minutes} min read`,
  ]
    .filter(Boolean)
    .join(" · ");

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${siteUrl}/blog/${post.slug}`,
    ...(heroAbs ? { image: heroAbs } : {}),
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
      { "@type": "ListItem", position: 2, name: "Journal", item: `${siteUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${siteUrl}/blog/${post.slug}` },
    ],
  };

  const faqJsonLd =
    post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const tocList = (
    <ol className="flex flex-col">
      {toc.map((h, i) => (
        <li key={h.id} className="border-t border-line first:border-t-0">
          <a
            href={`#${h.id}`}
            className="flex items-baseline gap-3 py-2 text-[14px] leading-[1.4] text-bone hover:text-gold"
          >
            <span className="font-serif text-[13px] text-gold">{String(i + 1).padStart(2, "0")}</span>
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );
  const hasToc = toc.length >= 3;

  return (
    <>
      <script
        type="application/ld+json"
        // Stringified post metadata from our own DB (validated on the write path).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      {/* Journal-style split hero: text on paper, the post's image as the
          right-hand panel (stacks under the text on phones). */}
      <section
        className={`relative grid border-b border-line ${post.heroImageUrl ? "min-h-[360px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]" : ""}`}
      >
        <div
          className={
            post.heroImageUrl
              ? "relative z-[1] pb-8 pl-[max(16px,calc((100vw-1240px)/2+32px))] pr-6 pt-[18px] max-md:pr-4 md:pl-[max(32px,calc((100vw-1240px)/2+32px))]"
              : "container-jn pb-8 pt-[18px]"
          }
        >
          <Breadcrumb
            items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/blog" }, { label: category }]}
            className="font-serif"
          />
          <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
          <h1 className="mt-2 max-w-[24ch] font-serif text-[clamp(34px,7vw,50px)] font-normal leading-[1.04] tracking-[-0.015em]">
            {post.title}
          </h1>
          <p className="mt-3 max-w-[52ch] font-serif text-[19px] leading-[1.4] text-bone-2">{post.description}</p>
          <p className="mt-5 flex items-center gap-2 text-[13px]">
            <span aria-hidden="true" className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
              JN
            </span>
            {post.author}
          </p>
        </div>
        {post.heroImageUrl ? (
          <figure className="relative min-h-[280px] bg-surface-2">
            {/* Hero is a plain <img>: URLs may be site-relative or Supabase
                Storage, and next/image would need every host allow-listed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.heroImageUrl}
              alt={post.heroImageAlt ?? post.title}
              width={1536}
              height={864}
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
            {post.heroImageAlt ? (
              <figcaption className="absolute bottom-[10px] right-[14px] max-w-[80%] truncate font-serif text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
                {post.heroImageAlt}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </section>

      <article
        className={`container-jn grid grid-cols-1 items-start gap-10 pt-9 lg:grid-cols-[minmax(0,1fr)_300px] ${hasToc ? "xl:grid-cols-[200px_minmax(0,1fr)_300px]" : ""}`}
      >
        {hasToc ? (
          <nav aria-label="In this article" className="max-xl:hidden xl:sticky xl:top-[calc(var(--header-h)+20px)]">
            <p className="eyebrow !mb-2 !text-[11px]">On this page</p>
            {tocList}
          </nav>
        ) : null}

        <div className="min-w-0">
          {hasToc ? (
            <details className="mb-8 border border-line bg-white px-5 py-1 xl:hidden">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-serif text-[18px] [&::-webkit-details-marker]:hidden">
                In this article
                <span aria-hidden="true" className="text-steel">+</span>
              </summary>
              <div className="pb-3">{tocList}</div>
            </details>
          ) : null}

          <div
            className="blog-prose max-w-[72ch]"
            // Markdown → HTML via src/lib/markdown.ts — sanitize-html strips
            // script/style/event handlers before this ever renders.
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {post.faq.length > 0 ? <PostFaq items={post.faq} /> : null}

          <p className="mt-12 border-t border-line pt-4 text-[13px] text-steel">
            {post.author} · Updated {postDateFmt.format(post.updatedAt)}
            {post.tags.length > 0 ? ` · ${post.tags.join(" · ")}` : ""}
          </p>
        </div>

        <aside className="flex flex-col gap-[14px] lg:sticky lg:top-[calc(var(--header-h)+20px)]">
          <PlanBox title="Put a number on it" sub="Route, date, passengers. The desk prices your trip against the same rate card." context="blog-post" />
          <div className="border border-line bg-panel p-5">
            <p className="eyebrow !mb-1">Keep exploring</p>
            <div className="mt-2 flex flex-col items-start gap-2 font-serif text-[15px]">
              <Link href="/guides/private-jet-charter-cost" className="border-b border-bone hover:text-gold">
                Pricing guide →
              </Link>
              <Link href="/aircraft" className="border-b border-bone hover:text-gold">
                Compare aircraft →
              </Link>
              <Link href="/blog" className="border-b border-bone hover:text-gold">
                All journal articles →
              </Link>
            </div>
          </div>
        </aside>
      </article>

      {related.length > 0 ? (
        <section className="container-jn mt-14">
          <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-8">
            <div>
              <p className="eyebrow !mb-1">Keep reading</p>
              <h2 className="font-serif text-[clamp(28px,6vw,36px)] font-normal leading-[1.1]">More from the desk.</h2>
            </div>
            <Link href="/blog" className="rule-link">
              All articles <span className="arrow-sm" aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {related.map((p) => (
              <PostCard key={p.slug} post={p} variant="card" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="container-jn mb-12 mt-12">
        <SubscribeCard />
      </section>

      <JournalCtaStrip
        title="Questions about what you just read?"
        body="Share your route, dates, passengers and priorities — the desk that wrote it will answer."
      />
    </>
  );
}
