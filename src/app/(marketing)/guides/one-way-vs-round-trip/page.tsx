import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
import { Reveal } from "@/components/reveal";
import { GuideShell } from "@/components/guide/guide-shell";
import { getGuideChapter } from "@/lib/guides";

export const metadata: Metadata = pageMetadata({
  title: "One-Way vs Round-Trip Private Jet Pricing",
  description:
    "One-way charters cost less than round trips, but rarely half — the aircraft flies home either way. The repositioning economics behind the price, and when an empty leg beats both.",
  path: "/guides/one-way-vs-round-trip",
});

const chapter = getGuideChapter("one-way-vs-round-trip")!;

const FAQ = [
  {
    q: "Why isn't a one-way half the round-trip price?",
    a: "Because the aircraft doesn't stay where you land. The operator either flies it home empty or repositions it toward its next charter, and that ferry time is a real cost someone pays. A one-way quote includes the operator's expected repositioning; a round trip amortizes the airframe over more billed hours.",
  },
  {
    q: "When is one-way clearly the right call?",
    a: "When your return date is uncertain or far out — paying for the round trip and then changing it is worse than quoting each direction when it's firm. Also when your route ends near a busy charter market, where the operator can often sell the return leg and price your one-way tighter.",
  },
  {
    q: "Can I fly one direction on an empty leg and charter the other?",
    a: "Yes, and it's often the best money in chartering: full-price flexibility on the direction with a fixed date, 30–60% off on the direction that can flex. Set a watchlist for the flexible direction and we'll text when a leg matches.",
  },
];

export default function OneWayVsRoundTripPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <GuideShell
      chapter={chapter}
      lead="Yes, one-way is cheaper — and no, not by half. The difference is repositioning: where the aircraft has to be next, and who pays for it to get there."
    >
      <script
        type="application/ld+json"
        // Build-time stringified site copy — not user-controlled.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-6">— The mechanics</p>
          </Reveal>
          <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
            The aircraft always flies both directions. The question is who&rsquo;s aboard.
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                k: "ROUND TRIP",
                h: "You buy both directions.",
                p: "The airframe stays with you (or returns for you), so every flown hour is a billed hour with you aboard. Per hour it's the most efficient way to buy the aircraft — which is why a round trip never costs double a one-way.",
              },
              {
                n: "02",
                k: "ONE WAY",
                h: "You buy one direction plus the operator's problem.",
                p: "After drop-off, the aircraft ferries home or toward its next mission. Your quote carries a share of that repositioning — smaller when you're flying into a busy charter market where the return leg is easy to resell, larger when you're flying somewhere aircraft rarely start from.",
              },
              {
                n: "03",
                k: "EMPTY LEG",
                h: "You buy someone else's repositioning.",
                p: "The mirror image of a one-way premium: that ferry flight goes on sale at 30–60% off. Date-locked and route-locked — but if your plans bend, it's the cheapest whole-aircraft flying there is.",
              },
            ].map((c, i) => (
              <Reveal key={c.n} stagger={(i % 3) as 0 | 1 | 2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-10">
                <div className="mb-6 flex items-baseline gap-4">
                  <span className="font-mono text-[42px] font-light leading-none text-clearance">{c.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">— {c.k}</span>
                </div>
                <h3 className="font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">{c.h}</h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 max-w-[68ch] text-[15px] leading-[1.6] text-bone-2">
            Practical upshot: quote the round trip whenever your dates are firm, quote one-ways when
            they aren&rsquo;t, and put a{" "}
            <Link href="/empty-legs" className="text-clearance">
              watchlist
            </Link>{" "}
            on whichever direction can flex. The wizard prices all three patterns —{" "}
            <Link href="/quote/mission" className="text-clearance">
              run your route
            </Link>{" "}
            both ways and compare; it takes about ninety seconds each.
          </p>
        </div>
      </section>

      <section className="border-t border-ink-3 bg-ink-2 py-24 max-md:py-16">
        <div className="container-jn">
          <Reveal>
            <p className="caption mb-10">— Asked about directions</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-3">
            {FAQ.map((f) => (
              <Reveal key={f.q} className="border-t border-ink-3 pt-6">
                <h3 className="font-serif text-[19px] font-normal leading-[1.3] tracking-tight text-bone">
                  {f.q}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{f.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </GuideShell>
  );
}
