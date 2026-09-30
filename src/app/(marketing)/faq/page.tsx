import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { CtaBand } from "@/components/cta-band";
import { FaqBoard } from "@/components/faq/faq-board";
import { SITE } from "@/lib/constants";
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
// it never drifts from what's rendered.
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

const CHANNELS = [
  {
    label: "Call",
    title: "Call dispatch.",
    strap: "Senior dispatcher answers, average pickup under 20 seconds.",
    big: SITE.dispatchPhone,
    href: `tel:${SITE.dispatchPhoneE164}`,
    highlight: false,
  },
  {
    label: "Email",
    title: "Email the desk.",
    strap: "Same desk, in writing. Reply within 30 minutes during business hours.",
    big: "dispatch@jetnine.com",
    href: "mailto:dispatch@jetnine.com",
    highlight: false,
  },
  {
    label: "Quote",
    title: "Start a quote.",
    strap: "Four-step form. Specific aircraft and pricing back inside thirty minutes.",
    big: "Begin →",
    href: "/quote/mission",
    highlight: true,
  },
];

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from FAQ catalog at build time — no user input, no XSS surface.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="container-jn pt-24 max-md:pt-12">
        <p className="mb-4 text-[14px] font-semibold text-bone-2">Frequently asked</p>
        <h1 className="title-page max-w-[16ch] !text-[clamp(44px,5.5vw,60px)]">
          The questions before the call.
        </h1>
        <p className="lead mt-5 max-w-[62ch]">
          Thirty-one answers, written by the dispatch desk, edited for the kind of question that
          comes in at 11pm on a Sunday. If yours isn&rsquo;t here, the line is open — same desk,
          same people.
        </p>
        <FaqBoard />
      </section>

      {/* Still stuck */}
      <section className="container-jn pt-20 max-md:pt-16">
        <p className="eyebrow">Still stuck?</p>
        <h2 className="title-section max-w-[26ch]">Pick a channel. Real human, every one.</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CHANNELS.map((c) => {
            const className = [
              "card card-pad flex h-full flex-col gap-2.5",
              c.highlight ? "!border-clearance" : "",
            ].join(" ");
            const body = (
              <>
                <span className={["text-[13px] font-semibold", c.highlight ? "text-gold" : "text-steel"].join(" ")}>
                  {c.label}
                </span>
                <span className="text-[22px] font-medium leading-[1.25] text-bone">{c.title}</span>
                <span className="text-bone-2">{c.strap}</span>
                <span className="mt-auto pt-2.5 font-serif text-[26px] font-light leading-tight text-bone">
                  {c.big}
                </span>
              </>
            );
            return c.href.startsWith("/") ? (
              <Link key={c.label} href={c.href} className={className}>
                {body}
              </Link>
            ) : (
              <a key={c.label} href={c.href} className={className}>
                {body}
              </a>
            );
          })}
        </div>
      </section>

      <CtaBand
        title="Answered enough? Price the trip."
        body="Four steps, live indicative pricing, and a senior dispatcher on the other end within thirty minutes."
      />
    </>
  );
}
