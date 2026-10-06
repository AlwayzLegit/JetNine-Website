"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { LightWindow, WindowButton } from "@/components/light/window";
import { GUIDE_TOPICS, type GuideTopic, type LibraryGuide } from "@/lib/guides-short";
import { GIcon, type GuideIconName } from "./icons";
import { GuidePreview, NbaaChecklist, PreBookingChecklist } from "./hub-windows";

type Chapter = { n: string; title: string; body: string; href: string };

const STAGES: [string, string, string, GuideIconName][] = [
  ["01", "Plan", "Understand your options and define your trip.", "compass"],
  ["02", "Compare", "Explore aircraft, costs and what’s included.", "plane"],
  ["03", "Book", "Request quotes, review and confirm.", "doc"],
  ["04", "Prepare", "Get ready for your flight with checklists and tips.", "bag"],
];

const FEATURED_COPY: [string, string][] = [
  ["First flight", "Understand the people, process and choices."],
  ["Costs", "Understand the total trip price and cost factors."],
  ["Booking", "Request, compare, confirm and prepare."],
];

function RouteCard() {
  return (
    <div className="bg-navy px-5 py-[22px] text-navy-on">
      <h3 className="font-serif text-[26px] leading-[1.1]">Have a route in mind?</h3>
      <p className="mt-2 text-[14px] text-navy-on-2">Use a planning estimate to frame your budget.</p>
      <div className="relative my-4 aspect-video overflow-hidden rounded-control">
        <Image src="/images/light/wing-over-sunset-clouds.webp" alt="" fill sizes="(max-width: 768px) 100vw, 420px" className="object-cover" />
      </div>
      <Link href="/cost-calculator" className="flex h-[42px] items-center justify-center rounded-control bg-gold text-[14px] font-bold text-white hover:opacity-90">
        Open cost calculator →
      </Link>
      <p className="mt-[10px] text-center text-[12px] text-navy-on-2">An estimate is not a confirmed quote.</p>
    </div>
  );
}

/**
 * The interactive part of /guides (Light - Guides.dc.html): hero with the
 * guide finder, journey stages, the topic sidebar and the main column
 * (featured trio, every guide, pricing chapters — or a filtered list).
 */
export function GuideLibrary({ guides, chapters }: { guides: LibraryGuide[]; chapters: Chapter[] }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<GuideTopic | "all">("all");
  const [preview, setPreview] = useState<LibraryGuide | null>(null);
  const [checklist, setChecklist] = useState(false);

  const ql = q.trim().toLowerCase();
  const results = ql ? guides.filter((g) => `${g.title} ${g.tag} ${g.body}`.toLowerCase().includes(ql)) : [];
  const list = guides.filter((g) => topic === "all" || g.topic === topic);
  const topicLabel = GUIDE_TOPICS.find((t) => t.key === topic)?.label ?? "All guides";
  const next = (g: LibraryGuide) => guides.filter((x) => x !== g).slice(0, 2);

  const previewBtn = (g: LibraryGuide, children: ReactNode, className: string) => (
    <button type="button" onClick={() => setPreview(g)} className={className}>
      {children}
    </button>
  );

  return (
    <>
      {/* Hero */}
      <section className="relative z-[5] border-b border-line">
        <Image src="/images/light/page-17-hero.webp" alt="" aria-hidden fill priority sizes="100vw" className="object-cover" style={{ objectPosition: "62% 55%" }} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg,rgba(247,245,240,.98) 0%,rgba(247,245,240,.95) 42%,rgba(247,245,240,.4) 64%,rgba(247,245,240,.1) 100%)" }}
        />
        <div className="container-jn relative pb-6 pt-[14px] max-md:[background:linear-gradient(rgba(247,245,240,.82),rgba(247,245,240,.82))]">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Guides" }]} />
          <p className="eyebrow !mb-[6px] mt-[14px] !tracking-[.22em]">The JetNine guide library</p>
          <h1 className="font-serif text-[clamp(34px,9vw,50px)] font-normal leading-[1.02] tracking-[-0.01em]">Private Jet Charter Guides</h1>
          <p className="mt-2 font-serif text-[24px] leading-[1.2]">Clear answers. Better flight decisions.</p>
          <p className="mt-[10px] max-w-[44ch] text-[14px] leading-[1.55]">
            Understand costs, compare aircraft and prepare for your flight. Start with the question that matters to you.
          </p>
          <div className="relative mt-[14px] max-w-[400px]">
            <label htmlFor="guide-find" className="block text-[12px] font-bold">
              Find a guide
            </label>
            <div className="mt-[5px] flex h-[42px] items-center gap-2 rounded-[3px] border border-line bg-surface px-3">
              <GIcon name="search" size={16} className="[&_path]:stroke-[var(--steel)]" />
              <input
                id="guide-find"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search costs, aircraft, booking or pets …"
                autoComplete="off"
                className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-bone outline-none placeholder:text-steel"
              />
              {ql ? (
                <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="border-0 bg-transparent p-0 text-[18px] leading-none text-steel">
                  ×
                </button>
              ) : null}
            </div>
            {ql ? (
              <div className="absolute inset-x-0 top-full z-10 mt-1 border border-line bg-surface px-[14px] py-3 shadow-[0_14px_40px_rgba(18,35,46,.16)]">
                <p className="mb-[6px] font-serif text-[17px]">Guides matching “{q.trim()}”</p>
                {results.slice(0, 3).map((g) => (
                  <Link key={g.href} href={g.href} className="flex items-center gap-[10px] border-t border-line py-[9px] text-bone hover:text-gold">
                    <GIcon name="doc" size={20} />
                    <span className="min-w-0 flex-1">
                      <b className="block text-[13px]">{g.title}</b>
                      <span className="text-[12px] text-steel">{g.tag}</span>
                    </span>
                    <span aria-hidden="true" className="text-steel">
                      ›
                    </span>
                  </Link>
                ))}
                {!results.length ? <p className="py-2 text-[13px] text-steel">No guides match yet. Try “cost”, “book”, “pets” or “safety”.</p> : null}
                <Link href="/cost-calculator" className="flex items-center gap-[10px] border-t border-line py-[9px] text-[13px] font-bold text-gold">
                  Cost calculator →
                </Link>
                {results.length ? (
                  <div className="pt-[6px] text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setTopic(results[0].topic);
                        setQ("");
                      }}
                      className="border-0 bg-transparent p-0 text-[13px] font-bold text-bone underline underline-offset-4"
                    >
                      View all matching guides →
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="mt-[10px] text-right text-[12px] text-steel">Illustrative cabin</p>
        </div>
      </section>

      {/* Journey stages */}
      <section aria-label="Journey stages" className="border-b border-line bg-surface">
        <div className="container-jn grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-y-3 py-[14px]">
          {STAGES.map(([n, t, b, ic], i) => (
            <div key={n} className={`grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3 px-5 max-sm:px-0 ${i ? "border-l border-line max-sm:border-l-0" : ""}`}>
              <GIcon name={ic} size={28} />
              <span>
                <span className="block text-[13px]">
                  <span className="mr-[6px] font-bold text-gold">{n}</span>
                  <b>{t}</b>
                </span>
                <span className="text-[12px] text-steel">{b}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="container-jn flex flex-wrap items-start gap-7 pt-6">
        {/* Sidebar */}
        <div className="min-w-0 max-w-full flex-[1_1_300px] self-stretch">
          <aside className="sticky top-[84px] bg-surface-2 px-[14px] pb-[18px] pt-4">
            <h2 className="mb-2 font-serif text-[20px]">Browse by topic</h2>
            {GUIDE_TOPICS.map((t) => {
              const on = topic === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTopic(t.key)}
                  className={`flex w-full items-center justify-between border-0 border-t border-line px-[10px] py-[9px] text-left text-[14px] ${on ? "bg-navy font-bold text-white" : "bg-transparent text-bone hover:text-gold"}`}
                >
                  <span>{t.label}</span>
                  {on ? <span aria-hidden="true">→</span> : null}
                </button>
              );
            })}
            <h3 className="mb-[6px] mt-5 font-serif text-[18px]">Useful tools</h3>
            <Link href="/cost-calculator" className="flex items-center gap-[10px] py-[7px] text-[13px] font-bold text-gold">
              <GIcon name="calcAlt" size={18} />
              Cost calculator →
            </Link>
            <Link href="/aircraft" className="flex items-center gap-[10px] py-[7px] text-[13px] font-bold text-gold">
              <GIcon name="plane" size={18} />
              Compare aircraft →
            </Link>
            <button type="button" onClick={() => setChecklist(true)} className="flex items-center gap-[10px] border-0 bg-transparent py-[7px] text-[13px] font-bold text-gold">
              <GIcon name="doc" size={18} />
              Booking checklist →
            </button>
          </aside>
        </div>

        {/* Main column */}
        <div className="min-w-0 flex-[999_1_420px]">
          {topic !== "all" ? (
            <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-1">
                  <h2 className="font-serif text-[28px]">{topicLabel}</h2>
                  <span className="bg-surface-2 px-2 py-[2px] text-[12px] text-steel">{list.length} guides</span>
                  <button type="button" onClick={() => setTopic("all")} className="border-0 bg-transparent p-0 text-[13px] text-bone underline underline-offset-[3px]">
                    Clear filter
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {list.map((g, i) => (
                    <div key={g.href} className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-[14px] gap-y-2 border border-line bg-surface px-[14px] py-3 sm:grid-cols-[32px_minmax(0,1fr)_auto_auto]">
                      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0">
                        <b className="block text-[14px]">{g.title}</b>
                        <span className="text-[12px] text-steel">{g.body}</span>
                      </span>
                      <span className="col-start-2 flex flex-wrap gap-2 sm:contents">
                        {previewBtn(g, "Preview", "h-[34px] rounded-control border border-line bg-surface px-3 text-[13px] text-bone hover:border-gold")}
                        <Link href={g.href} className="inline-flex h-[34px] items-center whitespace-nowrap rounded-control bg-gold px-3 text-[13px] font-bold text-white hover:opacity-90">
                          Read guide →
                        </Link>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <RouteCard />
            </section>
          ) : (
            <div>
              <h2 className="font-serif text-[28px] leading-[1.1]">Start with these three guides.</h2>
              <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-[14px]">
                {guides.slice(0, 3).map((g, i) => (
                  <article key={g.href} className="flex flex-col border border-line bg-surface">
                    <div className="relative aspect-[16/8] overflow-hidden bg-surface-2">
                      <Image src={g.img} alt="" fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col px-[14px] pb-[14px] pt-3">
                      <span className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">{FEATURED_COPY[i][0]}</span>
                      <h3 className="mt-[6px] font-serif text-[21px] leading-[1.15]">{g.title}</h3>
                      <p className="mb-[10px] mt-[6px] text-[13px] text-steel">{FEATURED_COPY[i][1]}</p>
                      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link href={g.href} className="whitespace-nowrap text-[13px] font-bold text-gold">
                          Read guide →
                        </Link>
                        {previewBtn(g, "Preview", "border-0 bg-transparent p-0 text-[13px] text-steel underline underline-offset-[3px]")}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <section className="mt-7">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="font-serif text-[26px] leading-[1.1]">Every guide in the collection.</h2>
                  <span className="text-[13px] text-steel">{guides.length} guides · pick a topic to narrow</span>
                </div>
                <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-[10px]">
                  {guides.map((g) => (
                    <Link key={g.href} href={g.href} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[10px] border border-line bg-surface px-[14px] py-3 transition-colors hover:border-gold">
                      <span>
                        <span className="block text-[12px] font-bold uppercase tracking-[.16em] text-gold">{g.tag}</span>
                        <span className="mt-1 block text-[14px] font-bold leading-[1.3]">{g.title}</span>
                        <span className="mt-[2px] block text-[12px] text-steel">{g.body}</span>
                      </span>
                      <span aria-hidden="true" className="text-gold">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-start gap-5">
                <div className="min-w-0">
                  <h2 className="font-serif text-[26px] leading-[1.1]">Understand the price, chapter by chapter.</h2>
                  <div className="mt-3 flex flex-col gap-2">
                    {chapters.map((c) => (
                      <Link key={c.href} href={c.href} className="flex items-center gap-[14px] border border-line bg-surface px-[14px] py-[11px] transition-colors hover:border-gold">
                        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">{c.n}</span>
                        <span className="min-w-0 flex-1">
                          <b className="block text-[14px]">{c.title}</b>
                          <span className="text-[12px] text-steel">{c.body}</span>
                        </span>
                        <span aria-hidden="true" className="text-gold">
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-[10px]">
                    <WindowButton
                      label="Compare proposals using the NBAA charter checklist ↗"
                      className="border-0 bg-transparent p-0 text-left text-[13px] font-bold text-bone underline decoration-line underline-offset-4"
                      title="Compare proposals with confidence"
                      sub="Use this checklist to review quotes from different providers and understand what’s included."
                    >
                      <NbaaChecklist />
                    </WindowButton>
                  </div>
                </div>
                <RouteCard />
              </section>
            </div>
          )}
        </div>
      </div>

      <LightWindow open={preview !== null} onClose={() => setPreview(null)} title={preview?.title} sub={preview ? `${preview.tag} · Quick preview` : undefined}>
        {preview ? <GuidePreview guide={preview} next={next(preview)} /> : null}
      </LightWindow>
      <LightWindow open={checklist} onClose={() => setChecklist(false)} title="Your pre-booking checklist">
        <PreBookingChecklist onClose={() => setChecklist(false)} />
      </LightWindow>
    </>
  );
}

/** "Open checklist →" trigger for the pre-booking band further down the page. */
export function PreBookingButton({ className, label }: { className: string; label: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <LightWindow open={open} onClose={() => setOpen(false)} title="Your pre-booking checklist">
        <PreBookingChecklist onClose={() => setOpen(false)} />
      </LightWindow>
    </>
  );
}

/** Hub FAQ: three cards, one open at a time. */
export function HubFaq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="mt-[10px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] items-start gap-[10px]">
      {items.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} className="border border-line bg-surface">
            <button
              type="button"
              aria-expanded={on}
              onClick={() => setOpen(on ? -1 : i)}
              className="flex w-full items-start gap-[10px] border-0 bg-transparent px-[14px] py-3 text-left text-[13px] font-bold text-bone"
            >
              <span aria-hidden="true" className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-gold text-[12px] text-gold">
                {on ? "−" : "+"}
              </span>
              <span>{q}</span>
            </button>
            <p hidden={!on} className="px-[14px] pb-3 pl-[42px] text-[13px] leading-[1.5] text-steel">
              {a}
            </p>
          </div>
        );
      })}
    </div>
  );
}
