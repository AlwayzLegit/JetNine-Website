import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/page-meta";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
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
// Anatomy (top to bottom): plain hero, hero image, body beside a sticky
// table of contents, FAQ (FAQPage JSON-LD), related posts, digest signup,
// closing CTA band.
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
      { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` },
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
    <ol className="flex flex-col gap-2.5">
      {toc.map((h, i) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            className="flex items-baseline gap-3 text-[14px] leading-[1.4] text-bone-2 transition-colors hover:text-bone"
          >
            <span className="text-[13px] text-steel">{i + 1}</span>
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

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

      <PageHero
        eyebrow={eyebrow}
        title={post.title}
        lead={post.description}
        titleClassName="!max-w-[24ch]"
      >
        <nav aria-label="Breadcrumb" className="mt-6 text-[14px] text-steel">
          <Link href="/" className="text-link">
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/blog" className="text-link">
            Blog
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-bone-2">{category}</span>
        </nav>
      </PageHero>

      {post.heroImageUrl ? (
        <figure className="container-jn pt-2">
          {/* Hero is a plain <img>: URLs may be site-relative or Supabase
              Storage, and next/image would need every host allow-listed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.heroImageUrl}
            alt={post.heroImageAlt ?? post.title}
            width={1536}
            height={864}
            className="aspect-[16/9] w-full rounded-card object-cover"
            loading="eager"
            fetchPriority="high"
          />
          {post.heroImageAlt ? (
            <figcaption className="mt-3 text-[13px] text-steel">{post.heroImageAlt}</figcaption>
          ) : null}
        </figure>
      ) : null}

      <article className="container-jn grid grid-cols-1 gap-12 pt-14 max-md:pt-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
        <div>
          {toc.length >= 3 ? (
            <nav aria-label="In this article" className="card card-pad mb-10 lg:hidden">
              <p className="label-jn mb-3">In this article</p>
              {tocList}
            </nav>
          ) : null}

          <div
            className="blog-prose"
            // Markdown → HTML via src/lib/markdown.ts — sanitize-html strips
            // script/style/event handlers before this ever renders.
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {post.faq.length > 0 ? <PostFaq items={post.faq} /> : null}

          <p className="mt-12 text-[14px] text-steel">
            {post.author} · Updated {postDateFmt.format(post.updatedAt)}
            {post.tags.length > 0 ? ` · ${post.tags.join(" · ")}` : ""}
          </p>
        </div>

        <aside className="max-lg:hidden">
          <div className="sticky top-28 flex flex-col gap-4">
            {toc.length >= 3 ? (
              <nav aria-label="In this article" className="card p-6">
                <p className="label-jn mb-3">In this article</p>
                {tocList}
              </nav>
            ) : null}
            <div className="card p-6">
              <p className="title-card-sm !text-[18px]">Put a number on it</p>
              <p className="mt-2 text-[14px] text-bone-2">
                Route, date, passengers. The desk prices your trip against the same rate card.
              </p>
              <Link href="/quote/mission" className="btn btn-primary btn-sm mt-4">
                Price a trip <span className="arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </aside>
      </article>

      {related.length > 0 ? (
        <section className="section-jn container-jn">
          <p className="eyebrow">Keep reading</p>
          <h2 className="title-section !text-[clamp(28px,3vw,36px)]">More from the desk.</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.slug} post={p} variant="card" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section-jn container-jn">
        <SubscribeCard compact />
      </section>

      <CtaBand
        title="Questions about what you just read?"
        body="The desk that wrote it picks up in under twenty seconds, every hour of every day."
      />
    </>
  );
}
