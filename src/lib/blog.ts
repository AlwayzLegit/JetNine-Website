import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { blogPosts, type BlogPost } from "@/db/schema/blog";
import { siteMediaUrl } from "@/lib/media";

// Shared between the admin API routes and the public /blog pages so
// slug rules and the "published means status + timestamp" contract live
// in exactly one place.

export const BLOG_DEFAULT_AUTHOR = "JetNine dispatch desk";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BlogPostInput = {
  slug?: string;
  title: string;
  description: string;
  bodyMd: string;
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  tags?: string[];
  faq?: { q: string; a: string }[];
  author?: string;
  status?: "draft" | "published";
  publishedAt?: string | null;
};

// Hand-rolled validation, matching the contact-form action style — the
// repo deliberately has no schema-validation dependency.
export function validatePostInput(
  body: unknown,
  { partial }: { partial: boolean },
): { ok: true; value: Partial<BlogPostInput> } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const out: Partial<BlogPostInput> = {};

  const str = (key: string, max: number, required: boolean): string | null => {
    const v = b[key];
    if (v === undefined) {
      if (required && !partial) throw new Error(`"${key}" is required.`);
      return null;
    }
    if (typeof v !== "string" || v.trim().length === 0) {
      throw new Error(`"${key}" must be a non-empty string.`);
    }
    if (v.length > max) {
      throw new Error(
        key === "title"
          ? `"title" exceeds ${max} characters — the site appends " · JetNine", and titles over ~70 total get truncated in search results.`
          : `"${key}" exceeds ${max} characters.`,
      );
    }
    return v.trim();
  };

  try {
    const title = str("title", 60, true);
    if (title !== null) out.title = title;

    const description = str("description", 160, true);
    if (description !== null) out.description = description;

    const bodyMd = str("bodyMd", 400_000, true);
    if (bodyMd !== null) out.bodyMd = bodyMd;

    const slug = str("slug", 96, false);
    if (slug !== null) {
      if (!SLUG_RE.test(slug)) {
        return { ok: false, error: '"slug" must be lowercase-hyphenated (a-z, 0-9, -).' };
      }
      out.slug = slug;
    }

    const author = str("author", 120, false);
    if (author !== null) out.author = author;

    if (b.heroImageUrl !== undefined) {
      if (b.heroImageUrl === null) out.heroImageUrl = null;
      else {
        const v = str("heroImageUrl", 600, false);
        if (v !== null) {
          if (!/^(https:\/\/|\/)/.test(v)) {
            return { ok: false, error: '"heroImageUrl" must be https:// or site-relative.' };
          }
          out.heroImageUrl = v;
        }
      }
    }
    if (b.heroImageAlt !== undefined) {
      out.heroImageAlt = b.heroImageAlt === null ? null : str("heroImageAlt", 300, false);
    }

    if (b.tags !== undefined) {
      if (
        !Array.isArray(b.tags) ||
        b.tags.length > 10 ||
        b.tags.some((t) => typeof t !== "string" || t.length === 0 || t.length > 40)
      ) {
        return { ok: false, error: '"tags" must be an array of up to 10 short strings.' };
      }
      out.tags = (b.tags as string[]).map((t) => t.trim());
    }

    if (b.faq !== undefined) {
      const bad =
        !Array.isArray(b.faq) ||
        b.faq.length > 12 ||
        b.faq.some((f) => {
          if (typeof f !== "object" || f === null) return true;
          const { q, a } = f as { q?: unknown; a?: unknown };
          return (
            typeof q !== "string" || typeof a !== "string" ||
            q.trim().length === 0 || a.trim().length === 0 ||
            q.length > 200 || a.length > 1500
          );
        });
      if (bad) {
        return { ok: false, error: '"faq" must be an array of up to 12 {q, a} objects (q ≤200 chars, a ≤1500).' };
      }
      out.faq = (b.faq as { q: string; a: string }[]).map((f) => ({ q: f.q.trim(), a: f.a.trim() }));
    }

    if (b.status !== undefined) {
      if (b.status !== "draft" && b.status !== "published") {
        return { ok: false, error: '"status" must be "draft" or "published".' };
      }
      out.status = b.status;
    }

    if (b.publishedAt !== undefined && b.publishedAt !== null) {
      if (typeof b.publishedAt !== "string" || Number.isNaN(Date.parse(b.publishedAt))) {
        return { ok: false, error: '"publishedAt" must be an ISO-8601 timestamp.' };
      }
      out.publishedAt = b.publishedAt;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input." };
  }

  return { ok: true, value: out };
}

// The public blog pages are ISR-cached; every admin write calls this so a
// publish, edit, hero swap or delete is visible immediately. `slugs` should
// include the old slug too when a PUT renames a post.
export function revalidateBlog(slugs: (string | null | undefined)[] = []): void {
  revalidatePath("/blog");
  revalidatePath("/blog/feed.xml");
  revalidatePath("/sitemap.xml");
  for (const s of new Set(slugs.filter((s): s is string => Boolean(s)))) {
    revalidatePath(`/blog/${s}`);
  }
}

// Every public read goes through this: hero images stored before the move
// to R2 still carry their Supabase Storage URL in the row (see lib/media.ts).
function withSiteMedia<T extends { heroImageUrl: string | null }>(row: T): T {
  return { ...row, heroImageUrl: siteMediaUrl(row.heroImageUrl) };
}

// Sitemap refreshes only need metadata, not every article's full body.
export async function getSitemapPosts() {
  const rows = await db.select({
    slug: blogPosts.slug,
    updatedAt: blogPosts.updatedAt,
    heroImageUrl: blogPosts.heroImageUrl,
  }).from(blogPosts).where(eq(blogPosts.status, "published"));
  return rows.map(withSiteMedia);
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.publishedAt));
  return rows.map(withSiteMedia);
}

export async function getPublishedPost(slug: string): Promise<BlogPost | undefined> {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))
    .limit(1);
  return row ? withSiteMedia(row) : undefined;
}

// Up to `limit` other published posts for the "keep reading" band under
// every article: posts sharing a tag first (most shared tags, then newest),
// then the article's neighbours in publish order, alternating the next
// older and the next newer post. The neighbours used to be "the newest
// three", which meant a post with no tag in common with anything else was
// linked from the journal index alone (Semrush: pages with one internal
// link). Neighbours give every post at least two inbound article links.
export async function getRelatedPosts(post: BlogPost, limit = 3): Promise<BlogPost[]> {
  const others = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.status, "published"), ne(blogPosts.id, post.id)))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(200);
  const mine = new Set(post.tags.map((t) => t.toLowerCase()));
  const picked = others
    .map((p, i) => ({ p, i, shared: p.tags.filter((t) => mine.has(t.toLowerCase())).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);

  if (picked.length < limit) {
    const at = post.publishedAt?.getTime() ?? Infinity;
    // `others` is newest first: everything before `split` is newer than this post.
    const split = others.findIndex((p) => (p.publishedAt?.getTime() ?? 0) <= at);
    const older = split === -1 ? [] : others.slice(split);
    const newer = (split === -1 ? others : others.slice(0, split)).reverse();
    const taken = new Set(picked.map((p) => p.id));
    for (let k = 0; picked.length < limit && (k < older.length || k < newer.length); k++) {
      for (const p of [older[k], newer[k]]) {
        if (p && !taken.has(p.id) && picked.length < limit) {
          taken.add(p.id);
          picked.push(p);
        }
      }
    }
  }
  return picked.map(withSiteMedia);
}

// Up to `limit` published posts relevant to a page, by tag/title match on
// the page's terms, newest first as the tiebreak and as the fallback when
// nothing matches. Cached per request so a page rendering several bands
// hits the DB once.
import { cache } from "react";
const cachedPublished = cache(async () => getPublishedPosts());

export async function getPostsForTopics(terms: string[], limit = 3): Promise<BlogPost[]> {
  const posts = await cachedPublished();
  const needles = terms.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 2);
  const scored = posts.map((p, i) => {
    const tags = p.tags.map((t) => t.toLowerCase());
    const title = p.title.toLowerCase();
    let score = 0;
    for (const n of needles) {
      if (tags.some((t) => t === n || t.includes(n) || n.includes(t))) score += 3;
      if (title.includes(n)) score += 1;
    }
    return { p, score: score * 100 - i };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}
