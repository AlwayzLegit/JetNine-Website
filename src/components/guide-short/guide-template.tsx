import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/light/breadcrumb";
import {
  SHORT_GUIDES,
  SHORT_GUIDE_SOURCES,
  shortGuideHref,
  type ShortGuide,
} from "@/lib/guides-short";
import { GIcon, InfoIcon } from "./icons";
import { BriefButton, BriefPanel } from "./brief";
import { GlossaryTerms, GuideChecklist, GuideFaq } from "./interactive";

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

function Photo({ src, alt = "", sizes, priority, className = "" }: { src: string; alt?: string; sizes: string; priority?: boolean; className?: string }) {
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
}

/**
 * The light "planning guide" template (Light - Guide 14.dc.html): split
 * hero with photo, quick-answer strip, on-page rail + numbered sections
 * (or the glossary's term finder) beside a trip-brief panel, comparison
 * table, scenario cards, checklist, sources, FAQ accordion, related
 * guides and a navy closing band.
 *
 * Pages that already existed before the redesign pass overrides (their
 * H1, lead, eyebrow, FAQ) plus `extra` — their original body section,
 * rendered after the table — so URLs, copy and schema stay intact.
 */
export function ShortGuideTemplate({
  guide,
  title = guide.title,
  dek = guide.dek,
  eyebrow = guide.eyebrow,
  crumb = guide.short,
  byline,
  faq = guide.faq,
  extra,
  after,
  context = `guide-${guide.slug}`,
}: {
  guide: ShortGuide;
  title?: string;
  dek?: string;
  eyebrow?: ReactNode;
  /** Breadcrumb label for this page. */
  crumb?: string;
  byline?: ReactNode;
  faq?: { q: string; a: string }[];
  /** Extra body section rendered after the comparison table. */
  extra?: ReactNode;
  /** Rendered between the related guides and the closing band. */
  after?: ReactNode;
  /** Analytics context for the trip brief. */
  context?: string;
}) {
  const g = guide;
  const isGlossary = Boolean(g.terms);
  const rail: [string, string][] = [
    [isGlossary ? "Find a term" : "Details", "#details"],
    [isGlossary ? "Common mix-ups" : g.table.title.replace(/[.?]$/, ""), "#table"],
    ...(g.cards.length ? ([["Scenarios", "#scenarios"]] as [string, string][]) : []),
    ["Checklist", "#checklist"],
    ["Sources", "#sources"],
    ["Questions", "#faqs"],
  ];
  const related = g.related
    .map((r) => {
      const p = SHORT_GUIDES.find((x) => x.slug === r.slug);
      return p ? { href: shortGuideHref(p.slug), title: p.title, short: p.short, img: r.img ?? p.hero } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const sources = g.sources.map((k) => ({ key: k, ...SHORT_GUIDE_SOURCES[k] }));

  return (
    <div className="bg-ink text-bone">
      {/* Hero */}
      <section className="container-jn flex flex-wrap items-stretch gap-6 pt-[14px]">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col justify-center pb-[18px] pt-[6px]">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Guides", href: "/guides" },
              { label: crumb },
            ]}
          />
          <p className="eyebrow !mb-0 mt-[22px] !tracking-[.2em]">{eyebrow}</p>
          <h1 className="mt-[10px] font-serif text-[clamp(34px,6vw,56px)] font-normal leading-[1.02] tracking-[-0.015em] [text-wrap:balance]">
            {title}
          </h1>
          <p className="mt-[14px] max-w-[46ch] text-[19px] leading-[1.35]">{dek}</p>
          {byline ? <p className="mt-3 text-[13px] text-steel">{byline}</p> : null}
          <div className="mt-[22px] flex flex-wrap gap-3">
            <a href="#details" className="btn btn-primary h-[44px] text-[14px] font-bold">
              {g.primaryCta} <span aria-hidden="true">↓</span>
            </a>
            <BriefButton
              label={g.toolTitle}
              title={g.toolTitle}
              fields={g.fields}
              context={context}
              className="btn h-[44px] border-navy bg-surface text-[14px] font-bold text-bone hover:bg-surface-2"
            />
          </div>
        </div>
        {g.heroB ? (
          <div className="relative grid aspect-[16/10] min-w-0 flex-[1_1_380px] grid-cols-2 gap-[3px] overflow-hidden bg-surface-2">
            <div className="relative overflow-hidden">
              <Photo src={g.hero} alt="Private charter cabin" sizes="(max-width: 768px) 50vw, 320px" priority />
              <span className="absolute bottom-[10px] left-3 text-[14px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">Private charter</span>
            </div>
            <div className="relative overflow-hidden">
              <Photo src={g.heroB} alt="Commercial first class suite" sizes="(max-width: 768px) 50vw, 320px" priority />
              <span className="absolute bottom-[10px] right-3 text-right text-[14px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">Commercial first class</span>
            </div>
          </div>
        ) : (
          <div className="relative aspect-[16/10] min-w-0 flex-[1_1_380px] overflow-hidden bg-surface-2">
            <Photo src={g.hero} sizes="(max-width: 768px) 100vw, 640px" priority />
            <span className="absolute bottom-2 right-[10px] whitespace-nowrap text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
              Illustrative aviation imagery
            </span>
          </div>
        )}
      </section>

      {/* Quick answer */}
      <div className="border-y border-line bg-surface-2">
        <div className="container-jn flex items-center gap-3 py-[10px] text-[14px]">
          <InfoIcon />
          <span>
            <span className="sr-only">Quick answer: </span>
            {g.takeaway}
          </span>
        </div>
      </div>

      {/* Details: rail + sections + brief */}
      <section id="details" className="container-jn flex scroll-mt-[84px] flex-wrap items-start gap-6 pt-6">
        <div className="min-w-[120px] max-w-full flex-[0_1_150px] max-md:hidden">
          <nav aria-label="On this page" className="sticky top-[88px]">
            <p className="mb-2 text-[12px] text-steel">On this page</p>
            {rail.map(([label, href], i) => (
              <a
                key={href}
                href={href}
                className={`block border-l-2 px-[10px] py-[6px] text-[13px] hover:text-gold ${i === 0 ? "border-gold font-bold text-bone" : "border-line text-steel"}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="min-w-0 flex-[999_1_420px]">
          {g.terms ? (
            <GlossaryTerms title={g.sectionsTitle} terms={g.terms} />
          ) : (
            <>
              <h2 className="font-serif text-[32px] leading-[1.1]">{g.sectionsTitle}</h2>
              <p className="mt-1 text-[15px] text-steel">{g.sectionsSub}</p>
              <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[10px]">
                {g.sections.map((s, i) => (
                  <div key={s.title} className="border border-line bg-surface px-[18px] pb-4 pt-[18px]">
                    <div className="flex items-center justify-between gap-[10px]">
                      <span className="font-serif text-[30px] text-gold">0{i + 1}</span>
                      <GIcon name={s.icon} size={30} />
                    </div>
                    <h3 className="mt-2 font-serif text-[20px] leading-[1.15]">{s.title}</h3>
                    <p className="mt-[6px] text-[13px] leading-[1.5] text-steel">{s.text}</p>
                  </div>
                ))}
              </div>
              {g.inline ? (
                <div className="relative mt-3 aspect-[16/7] overflow-hidden bg-surface-2">
                  <Photo src={g.inline} sizes="(max-width: 768px) 100vw, 720px" />
                  <span className="absolute bottom-2 left-[10px] whitespace-nowrap text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
                    Illustrative cabin imagery
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>
        <BriefPanel
          title={g.toolTitle}
          fields={g.fields}
          context={context}
          sideImg={
            g.sideImg ? (
              <>
                <div className="relative -mx-[18px] mt-[14px] aspect-[4/3] overflow-hidden bg-surface-2">
                  <Photo src={g.sideImg} sizes="340px" />
                </div>
                <p className="mt-4 text-[12px] text-steel">Check the exact aircraft and itinerary.</p>
              </>
            ) : null
          }
        />
      </section>

      {/* Table */}
      <section id="table" className="container-jn scroll-mt-[84px] pt-[30px]">
        <h2 className="font-serif text-[32px] leading-[1.1]">{g.table.title}</h2>
        <p className="mt-1 text-[15px] text-steel">Individual aircraft, operators and itineraries vary.</p>
        <div className="mt-[14px] overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[480px] border-collapse text-left">
            <thead>
              <tr className="bg-surface-2 text-[13px] font-bold">
                {g.table.headers.map((h) => (
                  <th key={h} scope="col" className="px-4 py-[10px] font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.table.rows.map((r) => (
                <tr key={r[0]} className="border-t border-surface-2 text-[14px] align-top">
                  <th scope="row" className="px-4 py-[10px] font-bold">
                    {r[0]}
                  </th>
                  {r.slice(1).map((c, i) => (
                    <td key={i} className="px-4 py-[10px] text-steel">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {extra}

      {/* Scenario cards */}
      {g.cards.length ? (
        <section id="scenarios" className="container-jn scroll-mt-[84px] pt-[30px]">
          <h2 className="font-serif text-[32px] leading-[1.1]">{g.cardsTitle}</h2>
          <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[14px]">
            {g.cards.map((c) => {
              const inner = (
                <>
                  <span className="relative block aspect-video overflow-hidden bg-surface-2">
                    <Photo src={c.img} sizes="(max-width: 768px) 100vw, 400px" />
                  </span>
                  <span className="flex items-start justify-between gap-3 px-4 py-[14px]">
                    <span>
                      <span className="block font-serif text-[19px]">{c.title}</span>
                      <span className="mt-1 block text-[13px] leading-[1.45] text-steel">{c.body}</span>
                    </span>
                    {c.href ? (
                      <span aria-hidden="true" className="mt-1 text-gold">
                        →
                      </span>
                    ) : null}
                  </span>
                </>
              );
              return c.href ? (
                <Link key={c.title} href={c.href} className="block border border-line bg-surface transition-colors hover:border-gold">
                  {inner}
                </Link>
              ) : (
                <div key={c.title} className="border border-line bg-surface">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <GuideChecklist title={g.checklistTitle} items={g.checklist} />

      {/* Sources */}
      <section id="sources" className="container-jn scroll-mt-[84px] pt-[30px]">
        <p className="eyebrow !mb-0 !tracking-[.2em]">Independent guidance</p>
        <h2 className="mt-[6px] font-serif text-[32px] leading-[1.1]">Check the original sources.</h2>
        <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[14px]">
          {sources.map((s) => (
            <div key={s.key} className="border border-line border-t-2 border-t-gold bg-surface px-[18px] py-4">
              <div className="text-[12px] font-bold uppercase tracking-[.14em] text-gold">{s.org}</div>
              <div className="mt-[6px] font-serif text-[19px] leading-[1.15]">{s.title}</div>
              <p className="mb-[10px] mt-[6px] text-[13px] leading-[1.5] text-steel">{s.note}</p>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-[13px] underline underline-offset-[3px] hover:text-gold">
                Open source <span aria-hidden="true">↗</span>
              </a>
              <div className="mt-1 text-[12px] text-steel">{host(s.url)}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-steel">Independent references; no endorsement implied. Local requirements vary.</p>
      </section>

      {/* FAQ */}
      <section id="faqs" className="container-jn flex scroll-mt-[84px] flex-wrap items-start gap-6 pt-[30px]">
        <h2 className="flex-[1_1_220px] font-serif text-[32px] leading-[1.1]">A few useful answers.</h2>
        <GuideFaq items={faq} />
      </section>

      {/* Related */}
      <section className="container-jn flex flex-wrap items-start gap-6 py-[30px]">
        <div className="flex-[1_1_180px]">
          <p className="eyebrow !mb-0 !tracking-[.2em]">Related guides</p>
          <h2 className="mt-[6px] font-serif text-[32px] leading-[1.1]">More to explore.</h2>
        </div>
        <div className="grid min-w-0 flex-[999_1_420px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          {related.map((r) => (
            <Link key={r.href} href={r.href} className="block border border-line bg-surface transition-colors hover:border-gold">
              <span className="relative block aspect-[16/8] overflow-hidden bg-surface-2">
                <Photo src={r.img} sizes="(max-width: 768px) 100vw, 300px" />
              </span>
              <span className="block px-[14px] py-3">
                <span className="block font-serif text-[17px] leading-[1.2]">{r.title}</span>
                <span className="mt-1 block text-[13px] text-steel">{r.short} →</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {after}

      {/* Closing band */}
      {/* No .on-navy here: the band hosts the brief drawer, which must keep light tokens. */}
      <section className="relative overflow-hidden bg-navy text-navy-on">
        <Image src={g.band} alt="" aria-hidden fill sizes="100vw" className="object-cover opacity-[.55]" style={{ objectPosition: "center 60%" }} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg,rgba(18,35,46,.96) 0%,rgba(18,35,46,.85) 50%,rgba(18,35,46,.2) 100%)" }}
        />
        <div className="container-jn relative flex flex-wrap items-center justify-between gap-5 py-[30px]">
          <div className="flex-[1_1_320px]">
            <h2 className="font-serif text-[30px] leading-[1.1]">{g.bandTitle}</h2>
            <p className="mt-[6px] text-[15px] text-navy-on-2">Share your route, passengers and requirements.</p>
          </div>
          <BriefButton
            label="Discuss your trip →"
            title={g.toolTitle}
            fields={g.fields}
            context={context}
            className="btn btn-on-navy h-[44px] text-[14px]"
          />
        </div>
      </section>
    </div>
  );
}
