import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/page-meta";
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
    a: "Because the aircraft doesn't stay where you land. The operator either flies it home empty or repositions it toward its next charter, and that ferry time is a real cost someone pays. A one-way quote includes the operator's expected repositioning; a round trip amortizes the aircraft over more billed hours.",
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

      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">The mechanics</p>
          <h2 className="title-section max-w-[26ch]">
            The aircraft always flies both directions. The question is who&rsquo;s aboard.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                k: "Round trip",
                h: "You buy both directions.",
                p: "The aircraft stays with you (or returns for you), so every flown hour is a billed hour with you aboard. Per hour it's the most efficient way to buy the aircraft — which is why a round trip never costs double a one-way.",
              },
              {
                n: "02",
                k: "One way",
                h: "You buy one direction plus the operator's problem.",
                p: "After drop-off, the aircraft ferries home or toward its next mission. Your quote carries a share of that repositioning — smaller when you're flying into a busy charter market where the return leg is easy to resell, larger when you're flying somewhere aircraft rarely start from.",
              },
              {
                n: "03",
                k: "Empty leg",
                h: "You buy someone else's repositioning.",
                p: "The mirror image of a one-way premium: that ferry flight goes on sale at 30–60% off. Date-locked and route-locked — but if your plans bend, it's the cheapest whole-aircraft flying there is.",
              },
            ].map((c) => (
              <div key={c.n} className="card card-pad max-md:p-5">
                <div className="mb-5 flex items-baseline gap-4">
                  <span className="font-serif text-[48px] font-light leading-none text-clearance">{c.n}</span>
                  <span className="label-jn">{c.k}</span>
                </div>
                <h3 className="title-card-sm text-bone">{c.h}</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-bone-2">{c.p}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[68ch] text-[16px] leading-[1.6] text-bone-2">
            Practical upshot: quote the round trip whenever your dates are firm, quote one-ways when
            they aren&rsquo;t, and put a{" "}
            <Link href="/empty-legs" className="text-link-strong">
              watchlist
            </Link>{" "}
            on whichever direction can flex. The wizard prices all three patterns —{" "}
            <Link href="/quote/mission" className="text-link-strong">
              run your route
            </Link>{" "}
            both ways and compare; it takes about ninety seconds each.
          </p>
        </div>
      </section>

      <section className="section-jn">
        <div className="container-jn">
          <h2 className="title-section max-w-[24ch]">Asked about directions.</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {FAQ.map((f) => (
              <div key={f.q} className="card card-pad max-md:p-5">
                <h3 className="title-card-sm text-bone">{f.q}</h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-bone-2">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </GuideShell>
  );
}
