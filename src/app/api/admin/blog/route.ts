import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema/blog";
import { authorizeBlogAdmin } from "@/lib/blog-admin-auth";
import { slugify, validatePostInput, revalidateBlog, BLOG_DEFAULT_AUTHOR } from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";

// Admin blog API — collection endpoints.
//
//   GET  /api/admin/blog        → list all posts (drafts included), newest first
//   POST /api/admin/blog        → create a post (draft by default)
//
// Auth: BLOG_ADMIN_API_KEY bearer token or an admin session — see
// src/lib/blog-admin-auth.ts. Full usage doc with curl examples: BLOG_API.md.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const unauthorized = () =>
  NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

export async function GET(req: Request) {
  const identity = await authorizeBlogAdmin(req);
  if (!identity) return unauthorized();

  const rows = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      status: blogPosts.status,
      tags: blogPosts.tags,
      author: blogPosts.author,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      createdAt: blogPosts.createdAt,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.createdAt));

  return NextResponse.json({ ok: true, posts: rows });
}

export async function POST(req: Request) {
  const identity = await authorizeBlogAdmin(req);
  if (!identity) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = validatePostInput(body, { partial: false });
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;

  // Reject markdown that sanitizes to nothing — an all-script "article"
  // would otherwise publish as an empty page.
  if (renderMarkdown(input.bodyMd!).trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "bodyMd rendered to empty HTML after sanitization." },
      { status: 400 },
    );
  }

  const slug = input.slug ?? slugify(input.title!);
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "Could not derive a slug from the title — pass one explicitly." },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `A post with slug "${slug}" already exists. PUT /api/admin/blog/${slug} to update it.` },
      { status: 409 },
    );
  }

  const status = input.status ?? "draft";
  const publishedAt =
    input.publishedAt != null
      ? new Date(input.publishedAt)
      : status === "published"
        ? new Date()
        : null;

  const [post] = await db
    .insert(blogPosts)
    .values({
      slug,
      title: input.title!,
      description: input.description!,
      bodyMd: input.bodyMd!,
      heroImageUrl: input.heroImageUrl ?? null,
      heroImageAlt: input.heroImageAlt ?? null,
      tags: input.tags ?? [],
      faq: input.faq ?? [],
      author: input.author ?? BLOG_DEFAULT_AUTHOR,
      status,
      publishedAt,
    })
    .returning();

  revalidateBlog([post.slug]);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  return NextResponse.json(
    { ok: true, post, url: `${base}/blog/${post.slug}` },
    { status: 201 },
  );
}
