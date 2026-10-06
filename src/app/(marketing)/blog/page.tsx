import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { JournalBoard, JournalSearch, type JournalPost } from "@/components/blog/journal-board";
import { postDateFmt } from "@/components/blog/post-card";
import { SubscribeCard } from "@/components/blog/subscribe-card";
import { JournalCtaStrip } from "@/components/blog/journal-cta";
import { getPublishedPosts } from "@/lib/blog";
import { readingMinutes } from "@/lib/markdown";

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

// Light - Journal. The nav calls it "Journal"; the URLs stay /blog.
const STAGES = [
  { n: "01", label: "Plan", href: "/guides" },
  { n: "02", label: "Compare", href: "/aircraft" },
  { n: "03", label: "Book", href: "/how-it-works" },
  { n: "04", label: "Fly", href: "/safety" },
] as const;

const STARTERS = [
  {
    title: "What does a charter really cost?",
    body: "Compare the complete itinerary, including fees and possible extras.",
    link: "Explore charter pricing",
    href: "/guides/private-jet-charter-cost",
    img: "/images/light/jet-mediterranean-sunset.webp",
  },
  {
    title: "How do I book a private jet?",
    body: "What to request, review and prepare before departure.",
    link: "See the booking steps",
    href: "/how-it-works",
    img: "/images/light/tan-handbag-jet-window.webp",
  },
] as const;

const SOURCES = [
  {
    org: "FAA",
    title: "Verify your charter operator",
    body: "Ask for the operator’s certificate and confirm aircraft authorization.",
    link: "Read FAA guidance",
    url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
    img: "/images/light/authority-building.webp",
  },
  {
    org: "NBAA",
    title: "Compare the complete quote",
    body: "Ask about the total trip price, additional charges and cancellation terms.",
    link: "See the charter checklist",
    url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/",
    img: "/images/light/jet-light.webp",
  },
  {
    org: "U.S. Department of State",
    title: "Prepare for international travel",
    body: "Check passport guidance and destination-specific travel information.",
    link: "Visit Travel.State.Gov",
    url: "https://travel.state.gov/",
    img: "/images/light/notebook-sunset-window.webp",
  },
  {
    org: "USDA APHIS",
    title: "Plan pet paperwork early",
    body: "Review destination requirements and health certificate steps with your veterinarian.",
    link: "Review pet travel guidance",
    url: "https://www.aphis.usda.gov/pet-travel",
    img: "/images/light/cockapoo-pet-carrier.webp",
  },
] as const;

const NEXT_LINKS = [
  { label: "Understand charter pricing", href: "/guides/private-jet-charter-cost" },
  { label: "Explore safety questions", href: "/safety" },
  { label: "Compare aircraft", href: "/aircraft" },
  { label: "See how booking works", href: "/how-it-works" },
] as const;

const UL = "border-b border-bone hover:text-gold";

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

  const summaries: JournalPost[] = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    topic: p.tags[0] ?? "Notes from the desk",
    date: p.publishedAt ? postDateFmt.format(p.publishedAt) : null,
    minutes: readingMinutes(p.bodyMd),
    ts: p.publishedAt ? p.publishedAt.getTime() : 0,
    img: p.heroImageUrl,
    alt: p.heroImageAlt ?? p.title,
    questions: p.faq.slice(0, 3).map((f) => f.q),
  }));

  const start = (
    <section>
      <h2 className="font-serif text-[32px] font-normal leading-[1.1]">New to private charter? Start here.</h2>
      <Link
        href="/guides"
        className="group mt-[14px] grid gap-[22px] border border-line bg-[#FBFAF7] p-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]"
      >
        <span className="relative block aspect-[16/10] overflow-hidden bg-surface-2">
          <Image src="/images/light/jet-twilight.webp" alt="" fill sizes="(max-width: 768px) 100vw, 460px" className="object-cover" />
        </span>
        <span className="block px-[10px] pb-[10px] pt-[14px] max-sm:pt-1">
          <span className="eyebrow !mb-0 block">Essential guide</span>
          <span className="mt-2 block font-serif text-[30px] leading-[1.1]">
            Private Jet Charter:
            <br />
            A Complete Beginner’s Guide
          </span>
          <span className="mt-2 block font-serif text-[15px] text-steel">
            A clear path from your first question to your first flight.
          </span>
          <span className="mt-[10px] block font-serif text-[14px]">Plan · Compare · Book · Fly</span>
          <span className="mt-3 inline-block border-b border-bone text-[13px] group-hover:text-gold">
            Read the beginner’s guide →
          </span>
        </span>
      </Link>
      <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {STARTERS.map((s) => (
          <Link key={s.href} href={s.href} className="group flex flex-wrap gap-[14px] border border-line bg-[#FBFAF7] p-2">
            <span className="relative block aspect-[4/3] min-w-0 max-w-full flex-[1_1_130px] overflow-hidden bg-surface-2">
              <Image src={s.img} alt="" fill sizes="(max-width: 768px) 100vw, 200px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-[999_1_200px] pb-1 pr-[6px] pt-[6px]">
              <span className="block font-serif text-[19px] leading-[1.15]">{s.title}</span>
              <span className="mt-1 block text-[13px] leading-[1.4] text-steel">{s.body}</span>
              <span className="mt-2 inline-block border-b border-bone text-[13px] group-hover:text-gold">{s.link} →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );

  const empty = (
    <div className="text-center">
      <div className="font-serif text-[22px]">First posts are on the way.</div>
      <p className="mx-auto mt-[6px] max-w-[60ch] text-[13px] text-steel">
        Until then, the{" "}
        <Link href="/guides" className="text-link">
          pricing guide
        </Link>{" "}
        and{" "}
        <Link href="/questions" className="text-link">
          question hub
        </Link>{" "}
        cover most of what people call about.
      </p>
    </div>
  );

  return (
    <>
      <script
        type="application/ld+json"
        // Stringified desk-authored post metadata from our own DB.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />

      {/* Split hero: text on paper, photo panel on the right. */}
      <section className="relative grid min-h-[280px] border-b border-line [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="relative z-[1] pb-7 pl-[max(16px,calc((100vw-1240px)/2+32px))] pr-6 pt-[18px] max-md:pr-4 md:pl-[max(32px,calc((100vw-1240px)/2+32px))]">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Journal" }]} className="font-serif" />
          <p className="eyebrow !mb-0 mt-5">The JetNine journal</p>
          <h1 className="mt-2 font-serif text-[clamp(34px,9vw,52px)] font-normal leading-[1.02] tracking-[-0.02em]">
            Private Jet Charter Insights &amp; Guides
          </h1>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.5]">
            Understand the cost. Choose the right aircraft. Know what to ask before you fly.
          </p>
          <JournalSearch posts={summaries} />
        </div>
        <div className="relative min-h-[280px] bg-surface-2">
          <Image src="/images/light/page-15-hero.webp" alt="" fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          <span className="absolute bottom-[10px] right-[14px] whitespace-nowrap font-serif text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
            Illustrative aviation imagery
          </span>
        </div>
      </section>

      <nav aria-label="Stages" className="border-b border-line bg-[#FBFAF7]">
        <div className="container-jn grid py-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
          {STAGES.map((s, i) => (
            <Link
              key={s.n}
              href={s.href}
              className={`flex items-baseline justify-center gap-[10px] py-[6px] font-serif text-[17px] hover:text-gold ${i ? "border-line sm:border-l" : ""}`}
            >
              <span className="text-[14px] text-gold">{s.n}</span>
              {s.label} <span aria-hidden="true" className="font-sans text-[13px]">→</span>
            </Link>
          ))}
        </div>
      </nav>

      <JournalBoard posts={summaries} start={start} empty={empty} />

      <section className="container-jn mt-10">
        <SubscribeCard />
      </section>

      <section className="mt-7 border-y border-line bg-[#F1EADF]">
        <div className="container-jn pb-5 pt-[22px]">
          <h2 className="font-serif text-[30px] font-normal leading-[1.1]">Go straight to the source.</h2>
          <p className="mt-1 text-[13px] text-steel">Useful starting points from regulators, industry bodies and manufacturers.</p>
          <div className="mt-[14px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {SOURCES.map((s) => (
              <div key={s.url} className="flex flex-wrap gap-4 border border-line bg-[#FBFAF7] p-2">
                <span className="relative block aspect-[4/3] min-w-0 max-w-full flex-[1_1_140px] overflow-hidden bg-surface-2">
                  <Image src={s.img} alt="" fill sizes="(max-width: 768px) 100vw, 220px" className="object-cover" />
                </span>
                <div className="min-w-0 flex-[999_1_200px] pb-1 pr-[6px] pt-[6px]">
                  <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold">{s.org}</div>
                  <div className="mt-1 text-[15px] font-bold">{s.title}</div>
                  <p className="mb-2 mt-1 text-[13px] leading-[1.45] text-steel">{s.body}</p>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={`whitespace-nowrap pb-px text-[13px] ${UL}`}>
                    {s.link} <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 border border-line bg-[#FBFAF7] p-2">
            <span className="relative block aspect-[4/1.6] min-w-0 max-w-full flex-[1_1_140px] overflow-hidden bg-surface-2">
              <Image src="/images/light/wing-clouds.webp" alt="" fill sizes="(max-width: 768px) 100vw, 220px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-[999_1_200px]">
              <div className="text-[15px] font-bold">Aircraft specifications</div>
              <div className="text-[13px] text-steel">Read the manufacturer’s assumptions. Actual range depends on the trip.</div>
            </div>
            <a href="https://www.gulfstream.com/en/aircraft/" target="_blank" rel="noopener noreferrer" className={`mr-[10px] max-w-full pb-px text-[13px] ${UL}`}>
              Gulfstream performance notes <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="mt-[10px] text-center text-[12px] text-steel">Independent sources. Links do not imply endorsement.</p>
        </div>
      </section>

      <section className="container-jn grid items-start gap-12 pb-[26px] pt-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div>
          <h2 className="font-serif text-[28px] font-normal leading-[1.1]">A useful next step for every question.</h2>
          <div className="mt-[14px] grid gap-x-6 gap-y-[10px] text-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            {NEXT_LINKS.map((l) => (
              <Link key={l.href + l.label} href={l.href} className={`justify-self-start whitespace-nowrap ${UL}`}>
                {l.label} →
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-serif text-[20px] font-normal">How to use this journal</h3>
          <p className="mt-2 text-[13px] leading-[1.5] text-steel">
            Start with the guide that matches your decision. Follow the original source for rules and
            technical details, then confirm the specifics for your flight.
          </p>
        </div>
      </section>

      <JournalCtaStrip />
    </>
  );
}
