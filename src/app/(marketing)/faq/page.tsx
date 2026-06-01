import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { FaqBoard } from "@/components/faq/faq-board";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Answers to the questions before the call. Written by the dispatch desk for the kind of question that comes in at 11pm on a Sunday.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <PageHeader
        kicker="Frequently asked"
        title="The questions before the call."
        lead="Forty-two answers, written by the dispatch desk, edited for the kind of question that comes in at 11pm on a Sunday. If yours isn't here, the line is open — same desk, same people."
      />

      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <FaqBoard />
        </div>
      </section>

      {/* Still stuck */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <Reveal className="mb-6">
            <p className="caption">— Still stuck?</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            Pick a channel. Real human, every one.
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              {
                badge: "CHANNEL 01",
                title: "Call dispatch.",
                strap: "Senior dispatcher answers, average pickup under 20 seconds.",
                big: SITE.dispatchPhone,
                href: `tel:${SITE.dispatchPhoneE164}`,
              },
              {
                badge: "CHANNEL 02",
                title: "Email the desk.",
                strap: "Same desk, in writing. Reply within 30 minutes during business hours.",
                big: "dispatch@jetnine.com",
                href: "mailto:dispatch@jetnine.com",
              },
              {
                badge: "CHANNEL 03",
                title: "Start a quote.",
                strap: "Four-step form. Specific aircraft and pricing back inside thirty minutes.",
                big: "Begin →",
                href: "/quote",
              },
            ].map((c, i) => (
              <Reveal
                key={c.badge}
                stagger={(i as 0 | 1 | 2)}
                className="rounded-[4px] border border-ink-3 bg-ink p-10 transition-all duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-clearance"
              >
                {c.href.startsWith("/") ? (
                  <Link href={c.href} className="block">
                    <ChannelBody c={c} />
                  </Link>
                ) : (
                  <a href={c.href} className="block">
                    <ChannelBody c={c} />
                  </a>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ChannelBody({ c }: { c: { badge: string; title: string; strap: string; big: string } }) {
  return (
    <>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
        — {c.badge}
      </span>
      <h3 className="mt-5 font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
        {c.title}
      </h3>
      <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.strap}</p>
      <div className="mt-6 font-serif text-[22px] font-light leading-tight tracking-tight text-bone">
        {c.big}
      </div>
    </>
  );
}
