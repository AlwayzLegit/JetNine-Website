"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { SITE } from "@/lib/constants";
import { FAQ, matchesQuery, type FaqItem } from "@/lib/faq";
import { track } from "@/lib/analytics";
import { FaqIcon, IconDisc, type FaqIconName } from "./faq-icons";
import { FaqWindows, openFaqWindow } from "./faq-windows";

const POPULAR = "popular";
const ALL = "all";

// Most-asked questions — the default "Popular questions" view.
const POPULAR_IDS = ["q01", "q06", "q11", "q13", "q24", "q05", "q20"];

const TOPIC_ICON: Record<string, FaqIconName> = {
  booking: "calendar",
  pricing: "card",
  aircraft: "plane",
  flight: "bag",
  international: "globe",
  changes: "doc",
  safety: "shield",
  memberships: "people",
};

// Quick topics: label shown, term searched.
const QUICK: [string, string][] = [
  ["Pricing", "price"],
  ["Pets", "pets"],
  ["Wi-Fi", "wi-fi"],
  ["Cancellation", "cancel"],
  ["Empty legs", "empty leg"],
];

type LinkSpec = { label: string; href: string } | { label: string; window: "pets" };

const COST = "/guides/private-jet-charter-cost";
const INTL = { label: "Prepare for international travel", href: "https://travel.state.gov" };
const SAFETY = { label: "JetNine safety guide", href: "/safety" };
const PROGRAMS = { label: "Compare programs", href: "/memberships" };
const HOW = { label: "How it works", href: "/how-it-works" };

// Follow-on links under each answer (the prototype's per-question links).
const LINKS: Record<string, LinkSpec[]> = {
  q01: [{ label: "Request a quote", href: "/quote/mission" }, HOW],
  q02: [HOW],
  q03: [{ label: "Start a quote", href: "/quote/mission" }],
  q04: [{ label: "Privacy policy", href: "/legal#sharing" }],
  q05: [{ label: "Explore empty legs", href: "/empty-legs" }],
  q06: [{ label: "Explore charter costs", href: COST }, { label: "Cost calculator", href: "/cost-calculator" }],
  q07: [{ label: "Payment terms", href: "/legal#payment" }],
  q08: [{ label: "Payment terms", href: "/legal#payment" }],
  q09: [{ label: "Cost calculator", href: "/cost-calculator" }],
  q10: [{ label: "Explore charter costs", href: COST }],
  q11: [{ label: "Compare aircraft", href: "/aircraft" }],
  q12: [{ label: "Compare aircraft", href: "/aircraft" }],
  q13: [{ label: "Flying with pets", window: "pets" }],
  q14: [{ label: "Compare cabins", href: "/aircraft" }],
  q15: [{ label: "Compare cabins", href: "/aircraft" }],
  q16: [HOW],
  q17: [HOW],
  q18: [{ label: "Compare aircraft", href: "/aircraft" }],
  q19: [HOW],
  q20: [INTL],
  q21: [INTL],
  q22: [INTL],
  q23: [{ label: "Cancellation terms", href: "/legal#cancellation" }],
  q24: [{ label: "Cancellation terms", href: "/legal#cancellation" }],
  q25: [{ label: "Read the agreement", href: "/legal#agreement" }],
  q26: [{ label: "How we vet operators", href: "/safety/operator-vetting" }, SAFETY],
  q27: [{ label: "Pilot standards", href: "/safety/pilot-standards" }],
  q28: [SAFETY],
  q29: [PROGRAMS],
  q30: [PROGRAMS],
  q31: [PROGRAMS],
};

type Row = FaqItem & { catId: string; catTitle: string };
const ROWS: Row[] = FAQ.flatMap((c) => c.items.map((it) => ({ ...it, catId: c.id, catTitle: c.title })));

const TOPICS: { id: string; label: string; icon: FaqIconName }[] = [
  { id: POPULAR, label: "Popular questions", icon: "question" },
  ...FAQ.map((c) => ({ id: c.id, label: c.title, icon: TOPIC_ICON[c.id] ?? "question" })),
];

function highlight(text: string, needle: string) {
  if (!needle) return text;
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-[#FFF2A8] px-[2px] text-bone">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

/**
 * Light - FAQ.dc.html: search bar + quick topics, the "Browse topics"
 * rail with the contact cards, and the question list (bordered cards with
 * a bronze topic eyebrow, copy-link and "Was this helpful?").
 *
 * Every answer stays in the server HTML — filtered-out and closed rows
 * are `hidden`, not unmounted — so the FAQPage JSON-LD always matches
 * content that is on the page.
 */
export function FaqBoard() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>(POPULAR);
  const [open, setOpen] = useState<Record<string, boolean>>({ [POPULAR_IDS[0]]: true });
  const [copied, setCopied] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, "yes" | "no">>({});

  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (needle) return ROWS.filter((r) => matchesQuery(r, needle) || r.catTitle.toLowerCase().includes(needle));
    if (topic === POPULAR) return POPULAR_IDS.map((id) => ROWS.find((r) => r.id === id)!).filter(Boolean);
    if (topic === ALL) return ROWS;
    return ROWS.filter((r) => r.catId === topic);
  }, [needle, topic]);
  const visibleIds = new Set(visible.map((r) => r.id));
  // Render order: the visible rows first (in their order), then the rest hidden.
  const ordered = [...visible, ...ROWS.filter((r) => !visibleIds.has(r.id))];

  const allOpen = visible.length > 0 && visible.every((r) => open[r.id]);
  const listTitle = needle
    ? `Results for “${query.trim()}”`
    : topic === ALL
      ? "All questions"
      : (TOPICS.find((t) => t.id === topic) ?? TOPICS[0]).label;

  // Deep links: /faq#q13 opens that answer; /faq#pricing selects the topic.
  const fromHash = useCallback(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (!h) return;
    const row = ROWS.find((r) => r.id === h);
    if (row) {
      setQuery("");
      setTopic(row.catId);
      setOpen({ [row.id]: true });
      requestAnimationFrame(() => document.getElementById(row.id)?.scrollIntoView({ block: "start" }));
    } else if (FAQ.some((c) => c.id === h)) {
      setQuery("");
      setTopic(h);
      setOpen({});
    }
  }, []);
  useEffect(() => {
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [fromHash]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 3500);
    return () => clearTimeout(t);
  }, [copied]);

  function selectTopic(id: string) {
    setTopic(id);
    setQuery("");
    setOpen(id === POPULAR ? { [POPULAR_IDS[0]]: true } : {});
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/faq#${id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(id);
  }

  function vote(row: Row, v: "yes" | "no") {
    setVoted((s) => ({ ...s, [row.id]: v }));
    track("faq_feedback", { question_id: row.id, helpful: v === "yes" });
  }

  return (
    <>
      <form onSubmit={(e: FormEvent) => e.preventDefault()} role="search" className="mt-4 flex border border-line bg-white">
        <label className="flex min-w-0 flex-1 items-center gap-[14px] px-[18px] max-sm:px-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="h-5 w-5 flex-none">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-4-4" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Search questions</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions — pricing, pets, baggage…"
            autoComplete="off"
            className="h-[50px] w-full min-w-0 border-0 bg-transparent text-[16px] text-bone outline-none placeholder:text-steel-dim"
          />
        </label>
        <button type="submit" className="h-[52px] flex-none border-0 bg-gold px-7 text-[15px] font-bold text-white max-sm:px-4">
          Search
        </button>
      </form>
      {needle ? (
        <div className="mt-[10px] flex items-center justify-between text-[13px] text-steel" aria-live="polite">
          <span>
            {visible.length} matching answer{visible.length === 1 ? "" : "s"}
          </span>
          <button type="button" onClick={() => setQuery("")} className="text-link border-0 bg-transparent p-0 text-[13px]">
            Clear search
          </button>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-[10px] text-[14px]">
        <span className="text-steel">Quick topics:</span>
        {QUICK.map(([label, term]) => {
          const on = needle === term;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => setQuery(on ? "" : term)}
              className={`h-8 rounded-pill border px-4 text-[14px] ${on ? "border-bone bg-bone text-white" : "border-line bg-white text-bone hover:border-steel"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-[22px] flex flex-wrap items-start gap-7">
        {/* Topic rail + contact cards */}
        <div className="min-w-0 max-w-full flex-[1_1_300px] self-stretch">
          <aside className="sticky top-[calc(var(--header-h)+20px)] flex flex-col gap-[14px]">
            <nav aria-label="FAQ topics" className="border border-line bg-white px-4 py-[18px]">
              <h2 className="mb-2 ml-1 font-serif text-[24px] font-normal">Browse topics</h2>
              {TOPICS.map((t) => {
                const on = !needle && topic === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => selectTopic(t.id)}
                    className={[
                      "grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-3 border-0 border-l-[3px] border-t border-t-[#ECE8DF] px-3 py-[10px] text-left text-[15px]",
                      on ? "border-l-gold bg-[#F7EFE4] font-bold text-gold" : "border-l-transparent bg-transparent text-bone hover:text-gold",
                    ].join(" ")}
                  >
                    <FaqIcon name={t.icon} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="on-navy bg-navy p-5">
              <h2 className="font-serif text-[24px] font-normal leading-[1.15]">Still have a question?</h2>
              <p className="mt-[6px] text-[14px] text-bone-2">Talk through your trip with the JetNine team.</p>
              <button
                type="button"
                onClick={() => openFaqWindow("question")}
                className="mt-[14px] h-10 w-full rounded-control border border-white bg-transparent text-[14px] font-bold text-white hover:bg-[rgba(255,255,255,0.08)]"
              >
                Ask a question <span aria-hidden="true">→</span>
              </button>
              <a href={`tel:${SITE.dispatchPhoneE164}`} className="mt-[14px] inline-flex items-center gap-[10px] text-[15px] text-white">
                <FaqIcon name="phone" stroke="#FFFFFF" strokeWidth={1.5} className="h-4 w-4" />
                {SITE.dispatchPhone}
              </a>
            </div>

            <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-[14px] border border-line bg-[#FBF8F2] p-[18px]">
              <IconDisc name="calendar" />
              <div>
                <div className="font-serif text-[19px]">Have a booking?</div>
                <p className="mb-2 mt-1 text-[13px] text-steel">Need to make a change or get help with an existing trip?</p>
                <button type="button" onClick={() => openFaqWindow("support")} className="text-link border-0 bg-transparent p-0 text-[13px]">
                  Get trip support <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Question list */}
        <div className="min-w-0 flex-[999_1_420px]">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-[34px] font-normal leading-[1.1] max-sm:text-[28px]">{listTitle}</h2>
            {visible.length > 0 ? (
              <button
                type="button"
                onClick={() => setOpen(allOpen ? {} : Object.fromEntries(visible.map((r) => [r.id, true])))}
                className="text-link flex-none border-0 bg-transparent p-0 text-[14px]"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {ordered.map((r) => {
              const shown = visibleIds.has(r.id);
              const isOpen = shown && Boolean(open[r.id]);
              const panelId = `faq-panel-${r.id}`;
              const v = voted[r.id];
              return (
                <article
                  key={r.id}
                  id={r.id}
                  hidden={!shown}
                  className={`scroll-mt-[calc(var(--header-h)+20px)] border bg-white ${isOpen ? "border-gold" : "border-line"}`}
                >
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen((s) => ({ ...s, [r.id]: !isOpen }))}
                      className="grid w-full grid-cols-[minmax(0,1fr)_28px] items-center gap-4 border-0 bg-transparent px-[18px] py-[14px] text-left text-bone"
                    >
                      <span>
                        <span className="block text-[12px] font-bold uppercase tracking-[.2em] text-gold">{r.catTitle}</span>
                        <span className="mt-1 block font-serif text-[21px] leading-[1.2]">{highlight(r.q, needle)}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-gold text-[18px] leading-none text-gold"
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                  </h3>
                  <div id={panelId} hidden={!isOpen} className="px-[18px] pb-[14px]">
                    <p className="max-w-[70ch] text-[15px] leading-[1.55] text-steel">{r.a}</p>
                    {LINKS[r.id]?.length ? (
                      <div className="mt-[10px] flex flex-wrap items-center gap-[14px] text-[14px]">
                        {LINKS[r.id].map((l) =>
                          "window" in l ? (
                            <button key={l.label} type="button" onClick={() => openFaqWindow(l.window)} className="text-link border-0 bg-transparent p-0 text-[14px]">
                              {l.label} <span aria-hidden="true">→</span>
                            </button>
                          ) : l.href.startsWith("http") ? (
                            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-link">
                              {l.label} <span aria-hidden="true">↗</span>
                            </a>
                          ) : (
                            <Link key={l.label} href={l.href} className="text-link">
                              {l.label} <span aria-hidden="true">→</span>
                            </Link>
                          ),
                        )}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECE8DF] pt-[10px] text-[13px]">
                      <button type="button" onClick={() => copyLink(r.id)} className="inline-flex items-center gap-[6px] border-0 bg-transparent p-0 text-[13px] text-bone">
                        <FaqIcon name="copy" stroke="currentColor" strokeWidth={1.5} className="h-[15px] w-[15px]" />
                        {copied === r.id ? "Link copied" : "Copy answer link"}
                      </button>
                      <span className="text-steel">
                        {v === "yes" ? (
                          "Thanks for the feedback."
                        ) : v === "no" ? (
                          <>
                            Thanks — we’ll improve this answer.{" "}
                            <button type="button" onClick={() => openFaqWindow("question", r.catTitle)} className="text-link border-0 bg-transparent p-0 text-[13px]">
                              Ask a question →
                            </button>
                          </>
                        ) : (
                          <>
                            Was this helpful?{" "}
                            <button type="button" onClick={() => vote(r, "yes")} className="border-0 bg-transparent px-1 text-[13px] text-bone">
                              Yes
                            </button>
                            |
                            <button type="button" onClick={() => vote(r, "no")} className="border-0 bg-transparent px-1 text-[13px] text-bone">
                              No
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
            {visible.length === 0 ? (
              <div className="border border-line bg-white p-6 text-center text-[14px] text-steel">
                No questions match “{query.trim()}”.{" "}
                <button type="button" onClick={() => openFaqWindow("question")} className="text-link border-0 bg-transparent p-0 text-[14px]">
                  Ask JetNine
                </button>
              </div>
            ) : null}
          </div>
          {topic !== ALL || needle ? (
            <div className="mt-3 text-center">
              <button type="button" onClick={() => selectTopic(ALL)} className="text-link border-0 bg-transparent p-0 text-[14px]">
                Browse all questions <span aria-hidden="true">↓</span>
              </button>
            </div>
          ) : null}

          <div className="mt-[18px] grid grid-cols-[52px_minmax(0,1fr)] gap-4 border border-line bg-[#FBF8F2] px-5 py-[18px] max-sm:grid-cols-1">
            <IconDisc name="shield" size={52} />
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[.2em] text-gold">Safety &amp; operators</div>
              <div className="mt-1 font-serif text-[22px]">How can I check my charter operator?</div>
              <p className="mt-[6px] text-[14px] text-steel">
                Ask for the operating carrier’s identity and its charter authorization. The FAA recommends checking the operator’s certificate before booking.
              </p>
              <div className="mt-2 flex flex-wrap gap-[14px] text-[14px]">
                <Link href="/safety" className="text-link">
                  JetNine safety guide <span aria-hidden="true">→</span>
                </Link>
                <span aria-hidden="true" className="text-line">
                  |
                </span>
                <a
                  href="https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  FAA charter guidance <span aria-hidden="true">↗</span>
                </a>
              </div>
              <p className="mt-[10px] border-t border-[#ECE8DF] pt-2 text-[12px] text-steel">{SITE.legal.part295}</p>
            </div>
          </div>
        </div>
      </div>

      {copied ? (
        <div role="status" className="fixed bottom-6 right-6 z-[900] flex items-center gap-[14px] bg-navy px-4 py-3 text-[14px] text-white shadow-[0_10px_30px_rgba(18,35,46,.3)] max-sm:left-4 max-sm:right-4">
          <span>Link copied ✓</span>
          <button type="button" onClick={() => setCopied(null)} aria-label="Dismiss" className="border-0 bg-transparent text-[18px] leading-none text-white">
            ×
          </button>
        </div>
      ) : null}

      <FaqWindows />
    </>
  );
}

// Re-exported so the server page can render buttons that open the windows.
export { FaqWindowButton } from "./faq-windows";
