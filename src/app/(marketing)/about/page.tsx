import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { ClosingCTA } from "@/components/closing-cta";
import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "JetNine is a senior-dispatcher charter brokerage in Los Angeles. One number, one desk, ready when you are.",
  path: "/about",
});

const HERO_STATS = [
  { label: "Founded", value: "2026", sub: "Los Angeles, California" },
  { label: "Dispatch", value: "24/7", sub: "Every hour, every day" },
  { label: "Network", value: "20K+", sub: "Aircraft worldwide" },
  { label: "Avg. response", value: "4 MIN", sub: "Call to dispatcher" },
];

const BELIEFS = [
  { num: "01", title: "A senior dispatcher beats software, every time.", why: "Apps quote stale fleet data in seconds. We quote real airframes in thirty minutes. The thirty minutes are because someone is on the phone with the operator, confirming pilot duty, confirming maintenance status, confirming whether the airframe will actually be available on the day. The app is faster — but the app is also wrong, sometimes, and the wrong-rate is sticker shock when you land." },
  { num: "02", title: "The price you accept is the price you pay.", why: "If fuel jumps 15% between acceptance and departure, that's our problem. If a Part 135 operator changes a fee, our problem. If we have to reposition because of a weather divert, our problem. We've absorbed roughly $400,000 in cost variance in the last 18 months. The number doesn't move once you accept it. Period." },
  { num: "03", title: "We say no to operators a lot.", why: "Our chief pilot rejects roughly 60% of operators that pass paper screening once he visits the hangar. That's a hard number to hold to when the client wants to fly tomorrow and the rejected operator has the only available airframe. The right answer is to ask the client to wait or fly commercial — and we say it, every time. We would rather refund an entire trip than fly an airframe we aren't comfortable with." },
  { num: "04", title: "You should not have to fight us on a refund.", why: "The hardest version of this work is when something goes sideways — operator backs out, weather forces a divert, family emergency on the client side. Our policy is to err on the client's side, every time, and to write the refund the same day. If a refund conversation ever feels like a fight, something has gone wrong on our end — and we treat it that way." },
  { num: "05", title: "We don't market our way out of bad operations.", why: "The fastest way to grow a charter brokerage is to spend on lead-gen and trade ops quality for booking volume. We've watched two competitors do exactly that, both bigger than us at the start of 2020, neither still in business. Our growth has been by referral; our headcount has tracked our flight volume; our ops staff have always outnumbered our sales staff. None of that is a strategy — it's just the only honest way to run the company." },
];

const FOUNDERS = [
  {
    initials: "AA",
    name: "Anna Agadzhanyan",
    role: "FOUNDER, CEO · DISPATCH LEAD",
    bio: [
      "Anna runs the dispatch side of the company — the desk, the operator relationships, the standard for what a quote has to look like before it leaves the building.",
      "Her view of the business is unromantic: show up early, work the phones, vet every operator personally, refund without arguing. The dispatch culture comes from her.",
    ],
    meta: [
      { lbl: "Leads", val: "Dispatch desk" },
      { lbl: "Based", val: "Los Angeles, CA" },
    ],
  },
  {
    initials: "AD",
    name: "Arman Adamson",
    role: "CO-FOUNDER, COO · OPERATIONS LEAD",
    bio: [
      "Arman owns the back end of the operation: operator network, audit cycle, finance, regulatory. He is the reason the Part 295 disclosure on every contract is in plain English.",
      "Operations is where charter brokerages quietly fail. His job is making sure the unglamorous parts — vetting, paperwork, insurance verification — hold to the same standard as the front desk.",
    ],
    meta: [
      { lbl: "Leads", val: "Operations" },
      { lbl: "Based", val: "Los Angeles, CA" },
    ],
  },
];

const TEAM = [
  { initials: "DG", name: "Daniel Garcia", role: "SENIOR DISPATCHER", meta: "East & Mid-Atlantic" },
  { initials: "RP", name: "Renata Padilla", role: "SENIOR DISPATCHER", meta: "Latin America" },
  { initials: "JL", name: "James Lee", role: "SENIOR DISPATCHER", meta: "Europe" },
  { initials: "SS", name: "Sarah Smith", role: "DISPATCHER", meta: "Pacific Northwest" },
  { initials: "AT", name: "Aamir Tyler", role: "DISPATCHER", meta: "Asia & Middle East" },
  { initials: "CA", name: "Catalina Anderson", role: "SENIOR DISPATCHER", meta: "West Coast" },
  { initials: "EM", name: "Eli Morison", role: "DISPATCHER · NIGHTS", meta: "24h desk" },
  { initials: "PF", name: "Patrice Fields", role: "CHIEF PILOT", meta: "Operator vetting" },
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
      jobTitle: f.role,
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
      {/* Hero — split text + stats */}
      <header className="relative overflow-hidden border-b border-ink-3 bg-ink pt-[200px] pb-24 max-md:pt-[140px] max-md:pb-16">
        {/* Full-bleed hero photo — an empty night dispatch ops room (no
            people/faces, per the issue #30 headshot policy). Mirrors the
            homepage hero + PageHeader two-axis scrim so bone text and the
            stat block stay AA-readable over the photo. */}
        <Image
          src="/images/hero/about.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(7,8,10,0.92) 0%, rgba(7,8,10,0.62) 34%, rgba(7,8,10,0.12) 64%, rgba(7,8,10,0.42) 100%), linear-gradient(180deg, rgba(7,8,10,0.72) 0%, rgba(7,8,10,0) 24%, rgba(7,8,10,0) 62%, rgba(7,8,10,0.9) 100%)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 18px)",
            }}
          />
        </div>
        <div className="container-jn relative z-10 grid gap-16 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
              <span className="block h-px w-8 bg-clearance" />
              About JetNine · est. 2026
            </Reveal>
            <Reveal as="h1" stagger={1} className="display-xl max-w-[18ch]">
              A small company built on the old idea of one phone number.
            </Reveal>
            <div className="mt-10 max-w-[60ch] space-y-6 text-[18px] leading-[1.55] text-bone-2">
              <Reveal as="p" stagger={2}>
                JetNine is a senior-dispatcher charter brokerage in Los Angeles. We
                don&rsquo;t run a marketing engine. We don&rsquo;t run a marketplace. We don&rsquo;t
                sell memberships unless you actually need one.
              </Reveal>
              <Reveal as="p" stagger={3}>
                Most of what we do, on most days, looks the same as it did in 1998 — pick up the
                phone, listen, work the operators, send back specific airframes with all-in pricing.
                That part is the work. Everything else is decoration.
              </Reveal>
            </div>
          </div>

          <Reveal stagger={2} className="grid grid-cols-2 gap-x-6 gap-y-8 self-end border-t border-ink-3 pt-8">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                  — {s.label}
                </span>
                <span
                  className="font-serif text-[32px] font-light leading-none tracking-tight text-bone"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {s.value}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                  {s.sub}
                </span>
              </div>
            ))}
          </Reveal>
        </div>
      </header>

      {/* Beliefs */}
      <section className="py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Beliefs</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
                Five things we refuse to compromise on.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                The shape of the company comes from these. They&rsquo;ve cost us business, on
                multiple occasions. They&rsquo;ve also kept us on the desks we still want to be on,
                fifteen years from now.
              </Reveal>
            </div>
          </div>

          <ul className="divide-y divide-ink-3 border-y border-ink-3">
            {BELIEFS.map((b, i) => (
              <Reveal
                key={b.num}
                stagger={(i % 3) as 0 | 1 | 2}
                as="li"
                className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[auto_1.2fr_1.4fr]"
              >
                <span className="font-serif text-[56px] font-light leading-none text-clearance lg:pr-6">
                  {b.num}
                </span>
                <h3 className="font-serif text-[24px] font-normal leading-[1.25] tracking-tight text-bone max-w-[28ch]">
                  {b.title}
                </h3>
                <p className="max-w-[60ch] text-[15px] leading-[1.7] text-bone-2">{b.why}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Founders */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Founders</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
                Two people you can talk to, on day one.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                Anna runs the dispatch side; Arman runs operations. They still answer their own
                phones.
              </Reveal>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {FOUNDERS.map((f, i) => (
              <Reveal
                key={f.name}
                stagger={(i as 0 | 1)}
                className="overflow-hidden rounded-[4px] border border-ink-3 bg-ink-2"
              >
                <Placeholder caption={f.initials} aspect="4/5" />
                <div className="p-10">
                  <h3 className="font-serif text-[28px] font-normal leading-[1.2] tracking-tight text-bone">
                    {f.name}
                  </h3>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    {f.role}
                  </p>
                  <div className="mt-6 space-y-4 text-[15px] leading-[1.65] text-bone-2">
                    {f.bio.map((para) => (
                      <p key={para.slice(0, 20)}>{para}</p>
                    ))}
                  </div>
                  <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-ink-3 pt-6">
                    {f.meta.map((m) => (
                      <div key={m.lbl} className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                          — {m.lbl}
                        </span>
                        <span className="font-mono text-[12px] tracking-[0.04em] text-bone">
                          {m.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— The desk</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[26ch]">
                The people who pick up.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[64ch] text-[18px] leading-[1.55] text-bone-2">
                When you call, one of these people answers. The same dispatcher handles your
                quote, your contract, and any in-flight changes — and stays with you across trips.
              </Reveal>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {TEAM.map((t, i) => (
              <Reveal
                key={t.name}
                stagger={(i % 3) as 0 | 1 | 2}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-5"
              >
                <Placeholder caption={t.initials} aspect="1/1" />
                <div className="mt-5">
                  <h3 className="font-serif text-[17px] font-normal leading-[1.2] tracking-tight text-bone">
                    {t.name}
                  </h3>
                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
                    {t.role}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                    {t.meta}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HQ */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Reveal className="mb-6">
                <p className="caption">— Headquarters</p>
              </Reveal>
              <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
                One office. One dispatch desk. Open 24 / 7 / 365.
              </Reveal>
              <div className="mt-8 max-w-[58ch] space-y-5 text-[17px] leading-[1.6] text-bone-2">
                <Reveal as="p" stagger={2}>
                  The dispatch desk is in Van Nuys, ten minutes from the FBO row at KVNY. We
                  deliberately don&rsquo;t have satellite offices — when something needs to be
                  solved at three in the morning, we want everyone in the same room.
                </Reveal>
                <Reveal as="p" stagger={2}>
                  The office is staffed every hour of every day. The night desk handles overseas
                  dispatch, weather diversions, and the small but annoying number of clients whose
                  calendars only allow them to think about a flight at 1 a.m.
                </Reveal>
              </div>
              <Reveal stagger={3} className="mt-8 rounded-[4px] border border-ink-3 bg-ink p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
                  — Address
                </div>
                <address className="mt-2 not-italic">
                  <span className="font-serif text-[18px] font-normal leading-[1.4] text-bone">
                    {SITE.address.line1}
                    <br />
                    {SITE.address.cityState}
                  </span>
                </address>
                <Link
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${SITE.address.line1}, ${SITE.address.cityState}`)}`}
                  className="mt-4 inline-flex font-mono text-[11px] uppercase tracking-[0.14em] text-clearance hover:opacity-80"
                  target="_blank"
                  rel="noopener"
                >
                  Directions →
                </Link>
              </Reveal>
            </div>
            <Reveal stagger={1}>
              <Placeholder
                caption="HQ — DISPATCH ROOM"
                aspect="4/5"
                imageUrl="/images/about/dispatch-room.webp"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <ClosingCTA
        heading="Talk to a dispatcher. Same one, every flight."
        body="Tell us the route. We'll be in touch within thirty minutes."
        primary={{ label: "Call dispatch", href: `tel:${SITE.dispatchPhoneE164}` }}
        secondary={{ label: "Request a quote", href: "/quote" }}
      />
    </>
  );
}
