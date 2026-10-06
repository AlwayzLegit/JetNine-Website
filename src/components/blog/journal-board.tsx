"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { LightWindow } from "@/components/light/window";

/** Serializable summary of a published post, built on the server. */
export type JournalPost = {
  slug: string;
  title: string;
  description: string;
  topic: string;
  date: string | null;
  minutes: number;
  /** Publish time (ms) — "Newest" sort. */
  ts: number;
  img: string | null;
  alt: string;
  /** Up to three FAQ questions, shown in the quick preview. */
  questions: string[];
};

const ALL = "All articles";

function Thumb({ post, className = "" }: { post: JournalPost; className?: string }) {
  return (
    <span className={`relative block overflow-hidden bg-surface-2 ${className}`}>
      {post.img ? (
        // Plain <img>: hero URLs may be site-relative or Supabase Storage.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

function Meta({ post }: { post: JournalPost }) {
  return (
    <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold">
      {post.topic}{" "}
      <span className="font-normal tracking-[0.08em] text-steel">
        {post.date ? `· ${post.date} ` : ""}· {post.minutes} min read
      </span>
    </div>
  );
}

/**
 * Light - Journal body: the "Browse by topic" rail (topics come from each
 * post's first tag), the start-here block (server-rendered, passed in),
 * and the article list with sort and a quick-preview drawer. Every row
 * is a real link to /blog/[slug], so the list is crawlable as-is.
 */
export function JournalBoard({ posts, start, empty }: { posts: JournalPost[]; start: ReactNode; empty: ReactNode }) {
  const [topic, setTopic] = useState(ALL);
  const [sort, setSort] = useState<"newest" | "shortest">("newest");
  const [preview, setPreview] = useState<JournalPost | null>(null);

  const topics = useMemo(() => [ALL, ...Array.from(new Set(posts.map((p) => p.topic)))], [posts]);
  const list = posts
    .filter((p) => topic === ALL || p.topic === topic)
    .sort((a, b) => (sort === "shortest" ? a.minutes - b.minutes : b.ts - a.ts));
  const filtered = topic !== ALL;

  return (
    <div className="container-jn flex flex-wrap items-start gap-7 pt-[22px]">
      <div className="min-w-0 max-w-full flex-[1_1_170px] self-stretch">
        <aside className="border-line pr-[14px] md:sticky md:top-[calc(var(--header-h)+20px)] md:border-r max-md:pr-0">
          <h2 className="font-serif text-[18px] font-normal">Browse by topic</h2>
          <div className="mt-[10px] flex flex-col gap-[2px] max-md:flex-row max-md:flex-wrap max-md:gap-2">
            {topics.map((t) => {
              const on = topic === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTopic(t)}
                  className={[
                    "-ml-[2px] border-0 border-l-2 px-[10px] py-[7px] text-left font-serif text-[14px]",
                    on ? "border-gold font-bold" : "border-transparent font-normal hover:text-gold",
                    on && t !== ALL ? "bg-navy text-white" : on ? "bg-surface-2 text-bone" : "bg-transparent text-bone",
                  ].join(" ")}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div className="max-md:hidden">
          <hr className="my-[18px] border-0 border-t border-line" />
          <h2 className="font-serif text-[18px] font-normal">Useful tools</h2>
          <div className="mt-[10px] flex flex-col items-start gap-2 font-serif text-[14px]">
            <Link href="/aircraft" className="whitespace-nowrap border-b border-bone hover:text-gold">
              Compare aircraft →
            </Link>
            <Link href="/guides/private-jet-charter-cost" className="whitespace-nowrap border-b border-bone hover:text-gold">
              Pricing guide →
            </Link>
            <Link href="/how-it-works" className="whitespace-nowrap border-b border-bone hover:text-gold">
              How booking works →
            </Link>
          </div>
          <div className="on-navy mt-[22px] bg-navy px-4 py-[18px]">
            <div className="font-serif text-[22px] leading-[1.15]">Have a trip in mind?</div>
            <p className="mt-2 text-[13px] leading-[1.45] text-navy-on-2">Share your route and priorities.</p>
            <Link
              href="/quote/mission"
              className="mt-3 inline-flex h-[34px] items-center whitespace-nowrap rounded-control bg-surface-2 px-3 text-[12px] font-bold !text-bone hover:bg-white"
            >
              Request a quote →
            </Link>
          </div>
          </div>
        </aside>
      </div>

      <div className="min-w-0 flex-[999_1_240px]">
        {!filtered ? start : null}

        <section className={filtered ? "" : "mt-[26px]"}>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-serif text-[30px] font-normal leading-[1.1]">
              {filtered ? topic : "Latest from the journal"}
            </h2>
            {posts.length > 1 ? (
              <label className="text-[12px] text-steel">
                Sort:{" "}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "newest" | "shortest")}
                  className="cursor-pointer border-0 bg-transparent text-[12px] font-bold text-bone"
                >
                  <option value="newest">Newest</option>
                  <option value="shortest">Shortest read</option>
                </select>
              </label>
            ) : null}
          </div>
          {filtered ? (
            <div className="mt-[10px] flex flex-wrap items-center gap-3 text-[13px]">
              <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-pill bg-surface-2 px-[10px] py-1">
                {topic}
                <button type="button" onClick={() => setTopic(ALL)} aria-label="Clear filter" className="border-0 bg-transparent p-0 text-[12px]">
                  ✕
                </button>
              </span>
              <button type="button" onClick={() => setTopic(ALL)} className="border-0 border-b border-bone bg-transparent p-0 text-[13px] text-bone">
                Clear filter
              </button>
              <span className="text-steel">
                {list.length} article{list.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}

          <div className="mt-3 flex flex-col">
            {list.map((p) => (
              <article key={p.slug} className="flex flex-wrap gap-[18px] border-t border-line py-3">
                <Link href={`/blog/${p.slug}`} tabIndex={-1} aria-hidden="true" className="block max-w-[280px] flex-[1_1_220px] max-sm:max-w-full">
                  <Thumb post={p} className="aspect-[16/10] w-full" />
                </Link>
                <div className="min-w-0 flex-[999_1_300px] py-1">
                  <Meta post={p} />
                  <h3 className="mt-[6px] font-serif text-[22px] font-normal leading-[1.15]">
                    <Link href={`/blog/${p.slug}`} className="hover:text-gold">
                      {p.title}
                    </Link>
                  </h3>
                  <p className="mt-[6px] text-[14px] leading-[1.45] text-steel">{p.description}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[12px]">
                      <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                        JN
                      </span>
                      JetNine dispatch desk
                    </span>
                    <span className="flex gap-[18px] text-[13px]">
                      <Link href={`/blog/${p.slug}`} className="whitespace-nowrap border-b border-bone hover:text-gold">
                        Read article →
                      </Link>
                      <button type="button" onClick={() => setPreview(p)} className="border-0 border-b border-bone bg-transparent p-0 text-[13px] text-bone hover:text-gold">
                        Quick preview
                      </button>
                    </span>
                  </div>
                </div>
              </article>
            ))}
            {list.length === 0 ? <div className="border border-line bg-panel p-7">{empty}</div> : null}
          </div>
        </section>
      </div>

      <LightWindow open={preview !== null} onClose={() => setPreview(null)} variant="drawer">
        {preview ? (
          <div>
            <p className="eyebrow !mb-0">Article preview</p>
            <Thumb post={preview} className="mt-3 aspect-[16/9] w-full" />
            <h2 className="mt-[14px] font-serif text-[26px] font-normal leading-[1.15]">{preview.title}</h2>
            <div className="mt-1 text-[12px] uppercase tracking-[0.1em] text-steel">
              {preview.date ? `${preview.date} · ` : ""}
              {preview.minutes} min read
            </div>
            <p className="mt-[10px] text-[14px] leading-[1.5] text-steel">{preview.description}</p>
            {preview.questions.length > 0 ? (
              <>
                <h3 className="mt-4 font-serif text-[17px] font-normal">Questions this article helps you ask</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {preview.questions.map((q) => (
                    <li key={q} className="flex items-center gap-[10px] text-[13px]">
                      <span aria-hidden="true" className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full bg-gold text-[11px] font-bold text-white">
                        ✓
                      </span>
                      {q}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="mt-[18px] grid grid-cols-2 gap-[10px]">
              <Link href={`/blog/${preview.slug}`} className="btn btn-primary btn-sm !h-10 !px-2 !text-[13px]">
                Read full article →
              </Link>
              <Link href="/aircraft" className="btn btn-secondary btn-sm !h-10 !px-2 !text-[13px]">
                Compare aircraft →
              </Link>
            </div>
            <p className="mt-[10px] text-[12px] text-steel">Full articles open on their own page.</p>
          </div>
        ) : null}
      </LightWindow>
    </div>
  );
}

const SUGGESTIONS = ["Charter costs", "Safety", "Empty legs"];

/**
 * Hero search: the inline field opens the "Search the journal" window,
 * which filters published posts by title, summary and topic.
 */
export function JournalSearch({ posts }: { posts: JournalPost[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const results = (
    q
      ? posts.filter((p) => [p.title, p.description, p.topic].some((s) => s.toLowerCase().includes(q)))
      : posts.slice(0, 3)
  ).slice(0, 5);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  const field = (big: boolean) => (
    <>
      <span aria-hidden="true" className="flex items-center px-3 text-steel">
        ⌕
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Try charter costs, safety or flying with pets"
        aria-label="Search the journal"
        className={`h-10 min-w-0 flex-1 border-0 bg-transparent text-bone outline-none placeholder:text-steel-dim ${big ? "text-[15px]" : "text-[14px]"}`}
      />
    </>
  );

  return (
    <>
      <form onSubmit={submit} role="search" className="mt-4 flex max-w-[500px] border border-line bg-white">
        {field(false)}
        <button type="submit" className="h-10 flex-none border-0 bg-navy px-[18px] text-[13px] font-bold text-white hover:bg-clearance-hover">
          Search
        </button>
      </form>
      <LightWindow open={open} onClose={() => setOpen(false)} title="Search the journal">
        <form onSubmit={submit} className="mt-[14px] flex gap-[10px]">
          <label className="flex min-w-0 flex-1 items-center border border-line bg-white">{field(true)}</label>
          <button type="submit" className="h-[42px] flex-none border-0 bg-navy px-5 text-[13px] font-bold text-white">
            Search
          </button>
        </form>
        <h3 className="mt-[18px] font-serif text-[20px] font-normal">
          {q ? `Results for “${query.trim()}”` : "Latest from the journal"}
        </h3>
        <div className="mt-[6px] flex flex-col">
          {results.map((r, i) => (
            <Link
              key={r.slug}
              href={`/blog/${r.slug}`}
              className="group grid grid-cols-[28px_90px_minmax(0,1fr)] items-center gap-[14px] border-t border-line py-3 max-sm:grid-cols-[72px_minmax(0,1fr)]"
            >
              <span className="font-serif text-[16px] text-steel max-sm:hidden">{String(i + 1).padStart(2, "0")}</span>
              <Thumb post={r} className="aspect-[16/10] w-full" />
              <span className="min-w-0">
                <Meta post={r} />
                <span className="mt-[2px] block font-serif text-[17px] leading-[1.2] group-hover:text-gold">{r.title}</span>
                <span className="block text-[12px] text-steel">{r.description}</span>
              </span>
            </Link>
          ))}
          {results.length === 0 ? (
            <p className="mt-[10px] border border-line bg-panel p-4 text-[13px] text-steel">
              {q ? `Nothing matches “${query.trim()}”. Try one of the suggestions below.` : "No articles published yet."}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-[10px] text-[13px] text-steel">
          Also try
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => setQuery(s)} className="h-[30px] border border-line bg-white px-3 text-[13px] text-bone hover:border-bone">
              ⌕ {s}
            </button>
          ))}
        </div>
      </LightWindow>
    </>
  );
}
