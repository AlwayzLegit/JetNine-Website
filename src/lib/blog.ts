import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, type BlogPost } from "@/db/schema/blog";

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
    if (v.length > max) throw new Error(`"${key}" exceeds ${max} characters.`);
    return v.trim();
  };

  try {
    const title = str("title", 200, true);
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

export async function getPublishedPosts(): Promise<BlogPost[]> {
  return db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.publishedAt));
}

export async function getPublishedPost(slug: string): Promise<BlogPost | undefined> {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))
    .limit(1);
  return row;
}
