"use client";

import { useMemo, useState } from "react";
import { FAQ, FAQ_QUICK_TAGS, matchesQuery } from "@/lib/faq";

export function FaqBoard() {
  const [query, setQuery] = useState("");

  // Native hash-jump doesn't scroll on mobile here — `body { overflow-x:
  // hidden }` makes <body> (not the viewport) the scroll element, so the
  // browser's default anchor scroll and `scroll-padding-top` (set on <html>)
  // don't apply. scrollIntoView targets the element in the actual scroller,
  // and the section's `scroll-mt` supplies the fixed-header offset.
  function onTocClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return; // section filtered out by search — let the default run
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  }

  const filtered = useMemo(() => {
    if (!query) return FAQ;
    return FAQ.map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => matchesQuery(it, query)),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[260px_1fr]">
      {/* Sticky TOC */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <p className="caption mb-5">— Contents</p>
        <nav>
          <ol className="flex flex-col gap-2">
            {FAQ.map((cat, i) => (
              <li key={cat.id}>
                <a
                  href={`#${cat.id}`}
                  onClick={(e) => onTocClick(e, cat.id)}
                  className="block py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2 transition-colors hover:text-bone"
                >
                  <span className="mr-3 text-clearance">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {cat.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <div>
        {/* Search */}
        <div className="mb-12 rounded-[4px] border border-ink-3 bg-ink-2 p-6">
          <label htmlFor="faq-search" className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
            — Search
          </label>
          <div className="mt-3 flex items-center gap-3 border-b border-steel pb-2 focus-within:border-clearance">
            <span className="font-mono text-clearance" aria-hidden>
              ⌕
            </span>
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a word — pets, lavatory, KTEB, deposit…"
              className="flex-1 border-none bg-transparent text-[15px] text-bone outline-none placeholder:text-steel"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {FAQ_QUICK_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQuery(t.toLowerCase())}
                className="rounded-full border border-ink-3 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:border-bone-2 hover:text-bone"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
            <h3 className="font-serif text-[24px] font-normal text-bone">
              No answers match &ldquo;{query}&rdquo;.
            </h3>
            <p className="mt-3 text-[15px] leading-[1.55] text-bone-2">
              Try a shorter word, or call the dispatch line — same desk, written by the same
              people.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-16">
            {filtered.map((cat, ci) => (
              <section key={cat.id} id={cat.id} className="scroll-mt-[6.5rem]">
                <div className="mb-6 flex items-baseline gap-4 border-b border-ink-3 pb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                    {String(FAQ.findIndex((c) => c.id === cat.id) + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-serif text-[26px] font-normal leading-tight tracking-tight text-bone">
                    {cat.title}
                  </h2>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                    {cat.items.length} answer{cat.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="divide-y divide-ink-3">
                  {cat.items.map((it, ii) => (
                    <li key={it.id}>
                      <details
                        className="group py-6"
                        open={ci === 0 && ii === 0 && !query}
                      >
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                          <h3 className="font-serif text-[18px] font-normal leading-[1.35] tracking-tight text-bone transition-colors group-hover:text-clearance">
                            <span className="mr-3 font-mono text-[10px] tracking-[0.14em] text-clearance">
                              {it.id.toUpperCase()}.
                            </span>
                            {it.q}
                          </h3>
                          <span className="font-mono text-[14px] text-clearance transition-transform duration-200 group-open:rotate-45">
                            +
                          </span>
                        </summary>
                        <div className="mt-4 max-w-[72ch] pl-12 text-[15px] leading-[1.7] text-bone-2">
                          <p>{it.a}</p>
                          {it.pullQuote ? (
                            <p className="mt-5 border-l-2 border-clearance pl-4 font-mono text-[11px] uppercase tracking-[0.12em] text-clearance">
                              {it.pullQuote}
                            </p>
                          ) : null}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
