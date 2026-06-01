import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { Placeholder } from "@/components/placeholder";
import { BestForIcon } from "@/components/best-for-icon";
import { ClosingCTA } from "@/components/closing-cta";
import { SITE } from "@/lib/constants";
import { FLEET, formatNm, formatPax, getFleetEntry } from "@/lib/fleet";
import { pageMetadata } from "@/lib/page-meta";

type RouteParams = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return FLEET.map((f) => ({ category: f.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) return {};
  return pageMetadata({
    title: entry.name,
    description: entry.lead.slice(0, 160),
    path: entry.href,
    image: entry.imageUrl,
    imageAlt: `JetNine ${entry.name.toLowerCase()} category — ${entry.heroImageCaption.replace(/^— /, "").toLowerCase()}`,
  });
}

export default async function AircraftCategoryPage({ params }: RouteParams) {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) notFound();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");

  // BreadcrumbList: Home › Aircraft › {Category}. Helps Google
  // surface the breadcrumb trail under the search result and improves
  // site hierarchy understanding.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Aircraft", item: `${siteUrl}/aircraft` },
      { "@type": "ListItem", position: 3, name: entry.name, item: `${siteUrl}${entry.href}` },
    ],
  };

  // Service: each category is a distinct service offering. Google
  // uses this for the services panel + better matching against
  // category-intent queries ("private heavy jet charter", etc.).
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Private aviation charter",
    name: `JetNine ${entry.name} Charter`,
    description: entry.lead.slice(0, 280),
    provider: {
      "@type": "Organization",
      name: "JetNine",
      url: siteUrl,
    },
    areaServed: { "@type": "Place", name: "Worldwide" },
    url: `${siteUrl}${entry.href}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Built from FLEET catalog at build time — no user input, no XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {/* ─── Hero: split text + image ─── */}
      <section className="pt-[200px] pb-24 max-md:pt-[140px] max-md:pb-16">
        <div className="container-jn">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            <div>
              <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
                <span className="block h-px w-8 bg-clearance" />
                {entry.kicker}
              </Reveal>
              <Reveal as="h1" stagger={1} className="display-xl max-w-[14ch]">
                {entry.title}
              </Reveal>
              <Reveal stagger={2} as="p" className="mt-8 max-w-[56ch] text-[18px] leading-[1.55] text-bone-2">
                {entry.lead}
              </Reveal>

              <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-ink-3 pt-8 sm:grid-cols-3">
                {entry.heroSpecs.map((s, i) => (
                  <Reveal
                    key={s.label}
                    stagger={(i % 3) as 0 | 1 | 2}
                    className="flex flex-col gap-1.5"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                      — {s.label}
                    </span>
                    <span
                      className="font-serif text-[28px] font-light leading-none text-bone"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {s.value}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {s.sub}
                    </span>
                  </Reveal>
                ))}
              </div>

              <Reveal stagger={3} className="mt-12 flex flex-wrap items-center gap-6">
                <Link href="/quote" className="btn btn-primary btn-lg">
                  Request a quote <span className="arrow">→</span>
                </Link>
                <Link href="/aircraft" className="btn btn-ghost">
                  All categories <span className="arrow">→</span>
                </Link>
              </Reveal>
            </div>

            <Reveal stagger={1}>
              <Placeholder
                caption={entry.heroImageCaption.replace(/^— /, "")}
                aspect="4/5"
                imageUrl={entry.imageUrl}
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="rounded-[4px] border border-ink-3"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Cabin ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Inside the cabin</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[20ch]">
              {entry.cabin.headline[0]}
              <br />
              {entry.cabin.headline[1]}
            </Reveal>
          </div>

          <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {entry.cabin.placeholders.map((cap, i) => (
              <Reveal
                key={cap}
                stagger={(i as 0 | 1 | 2)}
                className="overflow-hidden rounded-[4px] border border-ink-3"
              >
                <Placeholder
                  caption={cap}
                  aspect="4/5"
                  imageUrl={entry.cabin.imageUrls?.[i]}
                />
              </Reveal>
            ))}
          </div>

          <Reveal as="p" stagger={1} className="max-w-[64ch] text-[16px] leading-[1.7] text-bone-2">
            {entry.cabin.caption}
          </Reveal>
        </div>
      </section>

      {/* ─── Reach (Ultra-only) ─── */}
      {entry.reach ? (
        <section className="border-t border-ink-3 py-32 max-md:py-20">
          <div className="container-jn">
            <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
              <Reveal>
                <p className="caption">— Reach</p>
              </Reveal>
              <div>
                <Reveal as="h2" stagger={1} className="display-m max-w-[20ch]">
                  {entry.reach.headline[0]}
                  <br />
                  {entry.reach.headline[1]}
                </Reveal>
                <Reveal stagger={2} as="p" className="mt-6 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
                  {entry.reach.lead}
                </Reveal>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
              <div>
                <ul className="divide-y divide-ink-3 border-y border-ink-3">
                  {entry.reach.pairs.map((p) => (
                    <li
                      key={p.pair}
                      className="grid grid-cols-[1fr_auto_auto] items-baseline gap-8 py-5 font-mono text-[12px] uppercase tracking-[0.08em] text-bone"
                    >
                      <span className="text-bone">{p.pair}</span>
                      <span className="text-bone-2">{p.nm}</span>
                      <span className="text-clearance">{p.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Reveal stagger={1}>
                <div className="aspect-[4/3] overflow-hidden rounded-[4px] border border-ink-3 bg-ink-2 p-6">
                  <svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
                    <ellipse
                      cx="50"
                      cy="38"
                      rx="42"
                      ry="32"
                      fill="none"
                      stroke="rgba(232,226,210,0.15)"
                      strokeWidth="0.5"
                      strokeDasharray="1 1.5"
                    />
                    {/* Arcs */}
                    <path d="M22 32 Q 50 8 78 36" fill="none" stroke="#D4622A" strokeWidth="0.5" strokeDasharray="1.5 1.5" opacity="0.7" />
                    <path d="M22 32 Q 36 50 50 64" fill="none" stroke="#D4622A" strokeWidth="0.5" strokeDasharray="1.5 1.5" opacity="0.5" />
                    <path d="M78 36 Q 86 50 70 64" fill="none" stroke="#D4622A" strokeWidth="0.5" strokeDasharray="1.5 1.5" opacity="0.5" />
                    <path d="M22 32 Q 50 22 78 36" fill="none" stroke="var(--clearance)" strokeWidth="0.5" />
                    {/* Anchors */}
                    {[
                      { code: "JFK", x: 22, y: 32 },
                      { code: "LHR", x: 50, y: 22 },
                      { code: "HND", x: 82, y: 30 },
                      { code: "SIN", x: 78, y: 48 },
                      { code: "DXB", x: 60, y: 40 },
                      { code: "LAX", x: 15, y: 40 },
                      { code: "SYD", x: 80, y: 62 },
                    ].map((p) => (
                      <g key={p.code}>
                        <circle cx={p.x} cy={p.y} r="1" fill="var(--clearance)" />
                        <text
                          x={p.x}
                          y={p.y - 2.5}
                          fontSize="2.2"
                          fill="var(--bone-2)"
                          textAnchor="middle"
                          fontFamily="ui-monospace, monospace"
                          letterSpacing="0.05em"
                        >
                          {p.code}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── Sample aircraft ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Sample aircraft</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                A few airframes
                <br />
                in the network.
              </Reveal>
              <Reveal stagger={2} as="p" className="mt-6 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
                Representative examples — we source the right airframe per mission from a network of
                vetted Part 135 operators. Tail numbers redacted for crew privacy.
              </Reveal>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {entry.samples.map((s, i) => (
              <Reveal
                key={s.name}
                stagger={(i as 0 | 1 | 2)}
                className="overflow-hidden rounded-[4px] border border-ink-3 bg-ink-2 transition-colors hover:border-[rgba(232,226,210,0.3)]"
              >
                <Placeholder caption={s.phCap} aspect="16/10" />
                <div className="flex flex-col gap-3 p-7">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    {s.tail} · {s.base}
                  </span>
                  <h3 className="font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
                    {s.name}
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-ink-3 pt-5">
                    {[
                      ["PAX", s.pax.toString()],
                      ["RANGE", formatNm(s.rangeNm)],
                      ["SPEED", `${s.speedKt} KT`],
                      ["YEAR", s.year.toString()],
                      ["WIFI", s.wifi],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-steel">
                          {lbl}
                        </span>
                        <span className="font-mono text-[12px] tracking-[0.04em] text-bone">
                          {val}
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

      {/* ─── Best for ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— Best for</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
              The missions
              <br />
              {entry.shortName.toLowerCase()} does best.
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {entry.bestFor.map((t, i) => (
              <Reveal
                key={t.title}
                stagger={(i % 2) as 0 | 1}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-9 transition-all duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-clearance"
              >
                <div className="mb-6 text-clearance">
                  <BestForIcon name={t.iconKey} />
                </div>
                <h3 className="font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                  {t.title}
                </h3>
                <p className="mt-3 max-w-[44ch] text-[15px] leading-[1.6] text-bone-2">{t.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Teaser: step down / step up ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16">
            <Reveal>
              <p className="caption mb-4">— Considering alternatives</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              Compare the categories
              <br />
              on either side.
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[entry.teaser.left, entry.teaser.right].map((t, i) => (
              <Reveal key={t.href + i} stagger={(i as 0 | 1)} className="group">
                <Link
                  href={t.href}
                  className="flex h-full flex-col gap-6 rounded-[4px] border border-ink-3 bg-ink-2 p-10 transition-all duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-clearance"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                    — {t.label}
                  </span>
                  <h3 className="font-serif text-[28px] font-normal leading-[1.2] tracking-tight text-bone">
                    {t.title}
                  </h3>
                  <p className="text-[15px] leading-[1.6] text-bone-2">{t.body}</p>
                  <span className="mt-auto inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone">
                    {t.cta} <span className="arrow">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA
        heading={entry.finalCta.heading}
        body={entry.finalCta.body}
        secondary={{
          label: `Call dispatch · ${SITE.dispatchPhone}`,
          href: `tel:${SITE.dispatchPhoneE164}`,
        }}
      />
    </>
  );
}
