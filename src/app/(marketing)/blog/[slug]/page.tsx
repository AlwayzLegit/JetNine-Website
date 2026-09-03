import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { ClosingCTA } from "@/components/closing-cta";
import { QuoteLauncher } from "@/components/quote-launcher";
import { getPublishedPost, getRelatedPosts } from "@/lib/blog";
import { renderMarkdown, readingMinutes, extractToc } from "@/lib/markdown";

// Individual blog article — DB-backed, cached via ISR (see the note in
// ../page.tsx: force-dynamic drops font preloads). Drafts and unknown
// slugs 404 so nothing unpublished ever has a public URL; the admin API
// revalidates the slug on every write so publishing is immediate.
//
// Anatomy (top to bottom): breadcrumb, header, hero, sticky table of
// contents beside the body, FAQ (FAQPage JSON-LD), related posts, quote
// launcher, closing CTA.
export const revalidate = 3600;

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

      <header className="border-b border-ink-3 bg-ink pt-[160px] pb-14 max-md:pt-[120px] max-md:pb-10">
        <div className="container-jn">
          <Reveal>
            <nav
              aria-label="Breadcrumb"
              className="mb-8 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-steel"
            >
              <Link href="/" className="transition-colors hover:text-clearance">Home</Link>
              <span aria-hidden>/</span>
              <Link href="/blog" className="transition-colors hover:text-clearance">Blog</Link>
              <span aria-hidden>/</span>
              <span className="text-bone-2 normal-case tracking-normal">{category}</span>
            </nav>
          </Reveal>
          <Reveal className="mb-6 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
            <span className="text-clearance">{category}</span>
            <span className="text-steel">·</span>
            <span>{minutes} min read</span>
            {post.publishedAt ? (
              <>
                <span className="text-steel">·</span>
                <span>{dateFmt.format(post.publishedAt)}</span>
              </>
            ) : null}
          </Reveal>
          <Reveal as="h1" stagger={1} className="display-l max-w-[24ch]">
            {post.title}
          </Reveal>
          <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
            {post.description}
          </Reveal>
        </div>
      </header>

      {post.heroImageUrl ? (
        <figure className="container-jn -mt-px pt-12 max-md:pt-8">
          {/* Hero is a plain <img>: URLs may be site-relative or Supabase
              Storage, and next/image would need every host allow-listed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.heroImageUrl}
            alt={post.heroImageAlt ?? post.title}
            width={1536}
            height={864}
            className="aspect-[16/9] w-full rounded-[2px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
          {post.heroImageAlt ? (
            <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
              — {post.heroImageAlt}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <article className="py-16 max-md:py-12">
        <div className="container-jn grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            {toc.length >= 3 ? (
              <nav
                aria-label="In this article"
                className="mb-12 border-y border-ink-3 py-6 lg:hidden"
              >
                <p className="caption mb-4">— In this article</p>
                <ol className="flex flex-col gap-2">
                  {toc.map((h, i) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className="flex items-baseline gap-3 text-[14px] text-bone-2 transition-colors hover:text-clearance"
                      >
                        <span className="font-mono text-[10px] text-clearance">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <div
              className="blog-prose"
              // Markdown → HTML via src/lib/markdown.ts — sanitize-html strips
              // script/style/event handlers before this ever renders.
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {post.faq.length > 0 ? (
              <section className="mt-16" aria-labelledby="faq-heading">
                <p className="caption mb-2">— Questions this raises</p>
                <h2
                  id="faq-heading"
                  className="mb-6 font-serif text-[28px] font-normal leading-[1.2] tracking-tight text-bone max-md:text-[24px]"
                >
                  Asked at the desk
                </h2>
                <div className="border-y border-ink-3 divide-y divide-ink-3">
                  {post.faq.map((f) => (
                    <details key={f.q} className="group">
                      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                        <span className="text-[17px] leading-[1.35] text-bone transition-colors group-hover:text-clearance">
                          {f.q}
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 font-mono text-[14px] text-clearance transition-transform duration-200 group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="max-w-[70ch] pb-6 text-[15px] leading-[1.65] text-bone-2">
                        {f.a}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              — {post.author} · Updated {dateFmt.format(post.updatedAt)}
              {post.tags.length > 0 ? ` · ${post.tags.join(" · ")}` : ""}
            </p>
          </div>

          <aside className="max-lg:hidden">
            <div className="sticky top-28 flex flex-col gap-10">
              {toc.length >= 3 ? (
                <nav aria-label="In this article">
                  <p className="caption mb-4">— In this article</p>
                  <ol className="flex flex-col gap-3 border-l border-ink-3">
                    {toc.map((h, i) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="-ml-px flex items-baseline gap-3 border-l border-transparent pl-4 text-[13px] leading-[1.4] text-bone-2 transition-colors hover:border-clearance hover:text-bone"
                        >
                          <span className="font-mono text-[10px] text-clearance">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              ) : null}
              <div className="border-t border-ink-3 pt-6">
                <p className="caption mb-3">— Put a number on it</p>
                <p className="mb-4 text-[14px] leading-[1.55] text-bone-2">
                  Route, date, passengers. The wizard prices your trip live against current
                  market rates.
                </p>
                <Link href="/quote/mission" className="btn btn-primary btn-sm">
                  Price a trip <span className="arrow">→</span>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </article>

      {related.length > 0 ? (
        <section className="border-t border-ink-3 py-20 max-md:py-14">
          <div className="container-jn">
            <Reveal>
              <p className="caption mb-8">— Keep reading</p>
            </Reveal>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {related.map((p) => (
                <Reveal key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="group block">
                    <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-[2px] bg-ink-3">
                      {p.heroImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.heroImageUrl}
                          alt={p.heroImageAlt ?? p.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>
                    <p className="caption mb-2">{p.tags[0] ?? "Notes from the desk"}</p>
                    <h3 className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone transition-colors group-hover:text-clearance">
                      {p.title}
                    </h3>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

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
