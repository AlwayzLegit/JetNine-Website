"use client";

import { useId, useMemo, useState } from "react";
import { SITE } from "@/lib/constants";
import { FAQ, FAQ_QUICK_TAGS, matchesQuery } from "@/lib/faq";

const ALL = "all";

// Filter strip + topic rail + accordion groups from the simplification
// FAQ prototype. State: `query` (search over question + answer via
// matchesQuery), `cat` (topic id or "all"), `open` (question id — one row
// open at a time). Typing resets the topic to "All topics"; a quick tag
// sets the query to its label and toggles off on a second click.
export function FaqBoard() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>(ALL);
  const [open, setOpen] = useState<string | null>(FAQ[0]?.items[0]?.id ?? null);
  const searchId = useId();

  const needle = query.trim().toLowerCase();

  // Every category with its matching items, before the topic filter —
  // the rail needs the per-topic counts regardless of which is selected.
  const matched = useMemo(
    () => FAQ.map((c) => ({ ...c, items: c.items.filter((it) => matchesQuery(it, query)) })),
    [query],
  );
  const total = matched.reduce((n, c) => n + c.items.length, 0);
  const groups = matched.filter((c) => c.items.length > 0 && (cat === ALL || c.id === cat));

  const topics = [
    { id: ALL, title: "All topics", count: total },
    ...matched.map((c) => ({ id: c.id, title: c.title, count: c.items.length })),
  ];

  function onQueryChange(next: string) {
    setQuery(next);
    setCat(ALL);
  }

  return (
    <>
      {/* Search + quick tags */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="field-jn relative w-full max-w-[420px]">
          <label htmlFor={searchId} className="sr-only">
            Search the questions
          </label>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] leading-none text-steel"
          >
            ⌕
          </span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search — pets, deposit, Wi-Fi, customs…"
            autoComplete="off"
            className="h-[52px] !pl-11"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FAQ_QUICK_TAGS.map((tag) => {
            const on = needle === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                className="chip h-10 max-md:h-11"
                aria-pressed={on}
                onClick={() => onQueryChange(on ? "" : tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Topic rail + groups */}
      <div className="mt-12 grid grid-cols-1 items-start gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Topics"
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] max-lg:-mx-[var(--pad-x)] max-lg:px-[var(--pad-x)] lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {topics.map((t) => {
            const selected = cat === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCat(t.id)}
                className={[
                  "flex h-11 flex-none items-center gap-3 whitespace-nowrap text-[15px] transition-colors",
                  // Phones: a horizontal chip strip.
                  "rounded-pill border px-4",
                  selected
                    ? "border-clearance bg-clearance text-ink"
                    : "border-line-2 text-bone-2 hover:border-steel hover:text-bone",
                  // Desktop: a left rail with counts.
                  "lg:w-full lg:justify-between lg:rounded-control lg:border-0 lg:px-3.5 lg:text-left",
                  selected
                    ? "lg:bg-surface-2 lg:font-medium lg:text-bone"
                    : "lg:bg-transparent lg:text-bone-2 lg:hover:bg-surface-2",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clearance",
                ].join(" ")}
              >
                <span>{t.title}</span>
                <span
                  className={[
                    "pill h-[22px] px-2 text-[13px]",
                    selected ? "bg-transparent text-ink lg:text-steel-dim" : "bg-transparent text-steel-dim",
                  ].join(" ")}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {groups.length === 0 ? (
            <div className="rounded-card border border-dashed border-line-2 bg-surface px-6 py-10 text-center">
              <p className="text-[19px] text-bone">Nothing matches &ldquo;{query}&rdquo;.</p>
              <p className="mt-1.5 text-bone-2">
                Try another word, or{" "}
                <a href={`tel:${SITE.dispatchPhoneE164}`} className="text-link-strong">
                  call the desk
                </a>{" "}
                — a person answers.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section
                key={g.id}
                id={g.id}
                className="mb-10 scroll-mt-[calc(var(--header-h)+24px)] last:mb-0"
              >
                <h2 className="title-section mb-2 !text-[clamp(28px,3vw,32px)]">{g.title}</h2>
                <div className="accordion">
                  {g.items.map((it) => {
                    const isOpen = open === it.id;
                    const panelId = `faq-panel-${it.id}`;
                    return (
                      <div key={it.id} className="accordion-row">
                        <button
                          type="button"
                          className="accordion-trigger !items-start !py-5 !text-[19px]"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => setOpen((cur) => (cur === it.id ? null : it.id))}
                        >
                          <span>{it.q}</span>
                          <span className="accordion-sign" aria-hidden="true">
                            {isOpen ? "−" : "+"}
                          </span>
                        </button>
                        <div id={panelId} hidden={!isOpen} className="accordion-body !pb-[22px] leading-[1.65]">
                          <p>{it.a}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}
