import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { CtaBand } from "@/components/cta-band";
import { WindowButton } from "@/components/light/window";
import { SplitHero } from "@/components/company/split-hero";
import { FaqList } from "@/components/company/faq-list";
import { CheckDot, Disc, Icon, type IconName } from "@/components/company/icons";
import { RolesWindow, ContactWindow, FounderBio } from "@/components/about/windows";
import { FOUNDERS, TEAM } from "@/components/about/people";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "About Our Private Jet Charter Brokerage",
  description:
    "Learn how JetNine arranges private jet charter, supports your journey and works with independent aircraft operators. Understand our role as your charter broker.",
  path: "/about",
});

// Light - About (board 08). Real facts — founders, desk, phone, address —
// come from the existing page and @/lib/constants, not the prototype.

const FACTS = [
  ["Our role", "Charter brokerage"],
  ["Based in", "Los Angeles, California"],
  ["Founded", String(SITE.legal.foundedYear)],
  ["Flights operated by", "Independent authorized carriers"],
];

const ROLES = [
  {
    mark: "JN",
    title: "JetNine",
    sub: "Your charter broker",
    items: [
      "Discuss your itinerary and preferences",
      "Present aircraft options and quote details",
      "Coordinate booking and trip communication",
    ],
  },
  {
    mark: "✈",
    title: "The aircraft operator",
    sub: "Your direct air carrier",
    items: [
      "Provides the aircraft and flight crew",
      "Retains operational control of the flight",
      "Makes operational and safety decisions",
    ],
  },
];

const COVERS = [
  ["01", "Your actual trip", "Route, timing, passengers, baggage and accessibility needs."],
  ["02", "The complete quote", "Aircraft, operating carrier, included charges and possible extras."],
  ["03", "The terms that matter", "Payment, cancellation, changes, substitutions and refund conditions."],
];

const SOURCES = [
  {
    org: "FAA",
    title: "Check charter legitimacy",
    body: "Ask for the operator’s certificate and confirm that the aircraft is authorized for charter.",
    link: "Read FAA guidance",
    url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
  },
  {
    org: "U.S. DOT",
    title: "Understand the broker’s role",
    body: "Know the difference between the company arranging the flight and the carrier operating it.",
    link: "Read Part 295 · eCFR",
    url: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295",
  },
  {
    org: "NBAA",
    title: "Compare quotes carefully",
    body: "Request the operator, aircraft, complete price and cancellation terms.",
    link: "See charter questions",
    url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/request-for-proposals-aircraft-charter/",
  },
];

const REVIEW_CHECKS = [
  { t: "Aircraft & operator", d: "Confirm the aircraft is authorized for charter and understand who will operate the flight." },
  { t: "Cancellation & refund terms", d: "Understand the terms for changes, cancellations and refunds." },
  { t: "Included charges & possible extras", d: "Review what is included and ask about additional fees." },
  { t: "Written booking confirmation", d: "Get a confirmation that includes the operating carrier, aircraft and complete pricing." },
];

const DISPATCH_EMAIL = "dispatch@jetnine.com";

const NEXT: { title: string; body: string; href: string; icon: IconName }[] = [
  { title: "How it works", body: "From request to departure", href: "/how-it-works", icon: "plane" },
  { title: "Aircraft", body: "Compare cabin categories", href: "/aircraft", icon: "seat" },
  { title: "Safety", body: "Questions to ask your broker", href: "/safety", icon: "shield" },
  { title: "Charter guides", body: "Understand pricing and planning", href: "/guides", icon: "doc" },
];

// AboutPage + Person schema. AboutPage links the page to the
// Organization (declared on the root layout) so Google can connect
// the dots between 'JetNine' as an entity and this page as its
// authoritative about source. Person entries for the founders give
// the company named principals — useful for the knowledge panel and
// for 'who founded JetNine' queries.
const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About JetNine",
  description:
    "JetNine is a senior-dispatcher charter brokerage in Los Angeles. One number, one desk, ready when you are.",
  mainEntity: {
    "@type": "Organization",
    name: "JetNine",
    legalName: "JetNine LLC",
    foundingDate: "2026",
    foundingLocation: { "@type": "Place", name: "Los Angeles, CA" },
    founder: FOUNDERS.map((f) => ({
      "@type": "Person",
      name: f.name,
      jobTitle: f.jobTitle,
      worksFor: { "@type": "Organization", name: "JetNine" },
    })),
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from FOUNDERS catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />

      <SplitHero
        crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        eyebrow="Los Angeles · Private aviation"
        title="About JetNine"
        subtitle={
          <span className="text-steel">
            A clear point of contact.
            <br />
            From first request to departure.
          </span>
        }
        body={
          <p className="max-w-[46ch]">
            We are a Los Angeles private jet charter brokerage. We help travelers compare flight
            options and arrange charter with independent aircraft operators.
          </p>
        }
        actions={
          <>
            <Link href="/quote/mission" className="btn btn-primary !font-serif !text-[16px] !font-normal">
              Plan a flight <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/how-it-works" className="rule-link">
              See how it works →
            </Link>
          </>
        }
        imageSrc="/images/light/page-14-hero.webp"
      />

      {/* At a glance */}
      <section aria-label="At a glance" className="border-b border-line">
        <div className="container-jn grid py-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          {FACTS.map(([k, v], i) => (
            <div key={k} className={`px-3 py-1 text-center ${i ? "border-l border-line max-[420px]:border-l-0" : ""}`}>
              <div className="text-[12px] font-bold uppercase tracking-[0.22em]">{k}</div>
              <div className="mt-1 font-serif text-[19px]">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="container-jn pt-6">
        <p className="eyebrow !mb-2 !tracking-[0.2em]">Know who does what</p>
        <h2 className="font-serif text-[clamp(30px,7vw,38px)] leading-[1.1] tracking-[-0.01em]">
          One journey. Clear responsibilities.
        </h2>
        <div className="mt-[18px] grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {ROLES.map((r) => (
            <div key={r.title} className="border border-line bg-surface px-6 py-[22px] max-sm:px-5">
              <div className="flex items-center gap-[18px] border-b border-line pb-4">
                <Disc size={56} className="text-[22px]">{r.mark}</Disc>
                <div>
                  <div className="font-serif text-[21px] leading-[1.2]">{r.title}</div>
                  <div className="font-serif text-[15px] text-steel">{r.sub}</div>
                </div>
              </div>
              <ul className="mt-[14px] flex list-none flex-col gap-2 p-0">
                {r.items.map((it) => (
                  <li key={it} className="flex items-center gap-3 font-serif text-[15px]">
                    <CheckDot />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-4 font-serif text-[14px]">
          <span>Ask who will operate your flight before you book.</span>
          <WindowButton
            label="Understand broker and operator roles · DOT / eCFR ↗"
            className="rule-link !whitespace-normal border-0 border-b bg-transparent p-0 text-left !text-[14px]"
            variant="modal"
          >
            <RolesWindow />
          </WindowButton>
        </div>
      </section>

      {/* Founders + desk */}
      <section className="container-jn py-7">
        <p className="eyebrow !mb-2 !tracking-[0.2em]">The people</p>
        <h2 className="font-serif text-[clamp(30px,7vw,38px)] leading-[1.1] tracking-[-0.01em]">Meet the founders.</h2>
        <div className="mt-4 grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {FOUNDERS.map((p) => (
            <div key={p.name} className="flex items-center gap-5 border border-line bg-surface px-5 py-4">
              {/* Portrait placeholder — real photos still to be supplied. */}
              <Disc size={68} className="text-[26px]">{p.initials}</Disc>
              <div className="min-w-0">
                <div className="font-serif text-[21px] leading-[1.2]">{p.name}</div>
                <div className="font-serif text-[15px] leading-[1.4] text-steel">
                  {p.role}
                  <br />
                  {p.focus}
                </div>
                <WindowButton
                  label="Read bio →"
                  className="rule-link mt-1 border-0 border-b bg-transparent p-0 !text-[13px]"
                  title={p.name}
                  sub={p.jobTitle}
                >
                  <FounderBio bio={p.bio} />
                </WindowButton>
              </div>
            </div>
          ))}
          <div className="border-l border-line py-[6px] pl-6 font-serif text-[15px] leading-[1.5] text-steel max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-4">
            Know who you are working with. Ask questions early. Review the details before you commit.
            <div className="mt-[10px]">
              <WindowButton
                label="Contact the team →"
                className="rule-link border-0 border-b bg-transparent p-0"
                variant="modal"
              >
                <ContactWindow email={DISPATCH_EMAIL} />
              </WindowButton>
            </div>
          </div>
        </div>

        <h3 className="mt-8 font-serif text-[24px] leading-[1.15]">The people who pick up.</h3>
        <p className="mt-1 max-w-[64ch] font-serif text-[15px] text-steel">
          The same dispatcher handles your quote, your contract and any in-flight changes — and stays
          with you across trips.
        </p>
        <ul className="mt-4 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {TEAM.map((t) => (
            <li key={t.name} className="flex items-center gap-[14px] border border-line bg-surface px-4 py-3">
              <Disc size={44} className="text-[16px]">{t.initials}</Disc>
              <div className="min-w-0 leading-[1.35]">
                <div className="font-serif text-[17px]">{t.name}</div>
                <div className="text-[13px] text-steel">
                  {t.role} · {t.meta}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* What a useful conversation covers */}
      <section className="grid border-t border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="pb-[30px] pl-[max(var(--pad-x),calc((100vw-1240px)/2+var(--pad-x)))] pr-[var(--pad-x)] pt-7 md:pr-10">
          <h2 className="max-w-[18ch] font-serif text-[clamp(30px,7vw,38px)] leading-[1.1] tracking-[-0.01em]">
            What a useful charter conversation covers.
          </h2>
          <div className="mt-[22px] grid gap-y-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
            {COVERS.map(([n, title, body], i) => (
              <div key={n} className={i ? "border-l border-line px-5 max-[600px]:border-l-0 max-[600px]:px-0" : "pr-5"}>
                <div className="font-serif text-[28px] leading-none text-gold">{n}</div>
                <div className="mt-3 font-serif text-[18px]">{title}</div>
                <p className="mt-1 font-serif text-[14px] leading-[1.45] text-steel">{body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-h-[300px] bg-surface-2">
          <Image
            src="/images/light/lounge-conversation-wheelchair.webp"
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
          <span className="absolute bottom-[10px] right-[14px] whitespace-nowrap font-serif text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
            Illustrative aviation imagery
          </span>
        </div>
      </section>

      {/* Independent guidance */}
      <section className="border-y border-line bg-surface-2">
        <div className="container-jn pb-[26px] pt-[22px]">
          <p className="eyebrow !mb-2 !tracking-[0.2em]">Independent guidance</p>
          <h2 className="font-serif text-[clamp(30px,7vw,38px)] leading-[1.1] tracking-[-0.01em]">
            Verify the details. Use the original sources.
          </h2>
          <p className="mt-[6px] font-serif text-[16px] text-steel">
            These resources help you ask better questions. Links do not imply endorsement.
          </p>
          <div className="mt-[14px] grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            {SOURCES.map((s) => (
              <div key={s.org} className="border border-line bg-surface px-[18px] py-4">
                <div className="font-serif text-[20px] leading-[1.2]">{s.org}</div>
                <div className="font-serif text-[16px]">{s.title}</div>
                <p className="mb-3 mt-2 font-serif text-[14px] leading-[1.45] text-steel">{s.body}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="rule-link !text-[14px]">
                  {s.link} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-jn pt-6">
        <h2 className="font-serif text-[34px] leading-[1.1]">A few good questions.</h2>
        <FaqList
          className="mt-3"
          tone="serif"
          marks={["﹀", "−"]}
          items={[
            {
              q: "Does JetNine operate the aircraft?",
              a: "JetNine arranges charter as a broker. Independent direct air carriers provide and operate the flights.",
            },
            {
              q: "What should I review before accepting a quote?",
              a: "The named operating carrier, the aircraft, the complete price with inclusions and exclusions, and the payment, change and cancellation terms.",
              extra: (
                <>
                  <div className="mt-3 grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                    {REVIEW_CHECKS.map((c) => (
                      <div key={c.t} className="grid grid-cols-[20px_minmax(0,1fr)] gap-[10px] text-[13px]">
                        <span className="mt-[1px]">
                          <CheckDot size={18} />
                        </span>
                        <span>
                          <span className="font-serif text-[15px]">{c.t}</span>
                          <br />
                          <span className="text-steel">{c.d}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link href="/how-it-works" className="rule-link mt-3 !font-sans !text-[13px]">
                    See how booking works →
                  </Link>
                </>
              ),
            },
            {
              q: "How do I contact the team?",
              a: `Call ${SITE.dispatchPhone}, email ${DISPATCH_EMAIL}, or send a request from any page. A person answers twenty-four hours a day.`,
            },
          ]}
        />
      </section>

      {/* Next steps */}
      <section className="container-jn pb-[26px] pt-[22px]">
        <h2 className="font-serif text-[30px] leading-[1.1]">Explore your next step.</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          {NEXT.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-[14px] border border-line bg-surface px-4 py-3 transition-colors hover:border-gold"
            >
              <Icon name={n.icon} className="h-[30px] w-[30px]" />
              <span>
                <span className="block font-serif text-[16px]">{n.title}</span>
                <span className="font-serif text-[13px] text-steel">{n.body} →</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <CtaBand
        className="!mt-0"
        title="Tell us where you want to go."
        body="Share your itinerary, passenger count and priorities."
        primary={{ label: "Request a quote", href: "/quote/mission" }}
        secondary={null}
      />
    </>
  );
}
