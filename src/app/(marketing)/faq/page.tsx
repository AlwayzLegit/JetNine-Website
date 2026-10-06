import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { FaqBoard } from "@/components/faq/faq-board";
import { FaqWindowButton } from "@/components/faq/faq-windows";
import { IconDisc, type FaqIconName } from "@/components/faq/faq-icons";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = pageMetadata({
  title: "Private Jet Charter FAQ",
  description:
    "Answers to the questions before the call. Written by the dispatch desk for the kind of question that comes in at 11pm on a Sunday.",
  path: "/faq",
});

// FAQPage Schema.org JSON-LD. Google may surface these as a rich
// snippet (collapsible Q&A under the search result) when the markup
// matches the visible content. Built straight from the FAQ catalog so
// it never drifts from what's rendered (every answer is in the HTML).
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.flatMap((cat) =>
    cat.items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  ),
};

const DEEPER: { href: string; title: string; sub: string; link: string; icon: FaqIconName }[] = [
  { href: "/cost-calculator", title: "Estimate your trip", sub: "Explore cost factors", link: "Cost calculator", icon: "calc" },
  { href: "/aircraft", title: "Compare aircraft", sub: "Cabin, range and baggage", link: "Aircraft guide", icon: "plane" },
  { href: "/routes", title: "Plan your route", sub: "Airports and journey options", link: "Route guides", icon: "pin" },
  { href: "/legal#agreement", title: "Understand the terms", sub: "Payment and cancellation", link: "Legal & agreement", icon: "doc" },
];

const OFFICIAL: { href: string; title: string; link: string; icon: FaqIconName }[] = [
  {
    href: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
    title: "FAA · Charter safety",
    link: "Check operator authorization",
    icon: "bank",
  },
  { href: "https://www.aphis.usda.gov/pet-travel", title: "USDA APHIS · Pet travel", link: "Review destination requirements", icon: "paw" },
];

// Light - FAQ.dc.html
export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from FAQ catalog at build time — no user input, no XSS surface.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="container-jn pt-[18px]">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "FAQ" }]} />
        <p className="mb-[6px] mt-[14px] text-[12px] font-bold uppercase tracking-[.2em] text-bone">Answers before you fly</p>
        <h1 className="font-serif text-[clamp(34px,9vw,54px)] font-normal leading-[1.04] tracking-[-.01em]">Private Jet Charter FAQs</h1>
        <p className="mt-[6px] font-serif text-[22px] leading-[1.3] max-sm:text-[19px]">
          Clear answers on booking, pricing, aircraft and your journey.
        </p>

        <FaqBoard />

        <section className="mt-7">
          <h2 className="font-serif text-[32px] font-normal leading-[1.1] max-sm:text-[28px]">Go deeper when you need to.</h2>
          <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            {DEEPER.map((d) => (
              <Link key={d.title} href={d.href} className="group grid grid-cols-[48px_minmax(0,1fr)] gap-3 border border-line bg-white p-4 hover:border-gold">
                <IconDisc name={d.icon} />
                <span>
                  <span className="block font-serif text-[18px]">{d.title}</span>
                  <span className="block text-[13px] text-steel">{d.sub}</span>
                  <span className="mt-2 inline-block text-[13px] underline underline-offset-[3px] group-hover:text-gold">
                    {d.link} <span aria-hidden="true">→</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-[22px] pb-[22px]">
          <h2 className="font-serif text-[32px] font-normal leading-[1.1] max-sm:text-[28px]">Official guidance, in context.</h2>
          <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {OFFICIAL.map((o) => (
              <a
                key={o.title}
                href={o.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group grid grid-cols-[48px_minmax(0,1fr)] items-center gap-[14px] border border-line bg-white px-4 py-[14px] hover:border-gold"
              >
                <IconDisc name={o.icon} />
                <span>
                  <span className="block font-serif text-[18px]">{o.title}</span>
                  <span className="text-[13px] underline underline-offset-[3px] group-hover:text-gold">
                    {o.link} <span aria-hidden="true">↗</span>
                  </span>
                </span>
              </a>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-steel">Independent references. No endorsement implied.</p>
        </section>
      </div>

      <section className="bg-[#F0EBE2]">
        <div className="container-jn flex flex-wrap items-center justify-between gap-5 py-[18px]">
          <div>
            <h2 className="font-serif text-[24px] font-normal leading-[1.15]">Your trip deserves a specific answer.</h2>
            <p className="mt-[2px] text-[14px] text-steel">Share your route, dates and travel needs.</p>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            <FaqWindowButton win="question" className="btn h-[42px] border-gold bg-gold px-[22px] text-white hover:opacity-90">
              Ask JetNine <span aria-hidden="true">→</span>
            </FaqWindowButton>
            <Link href="/quote/mission" className="btn btn-secondary h-[42px] px-[22px]">
              Request a quote <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
