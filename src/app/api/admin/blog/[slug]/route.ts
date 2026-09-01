import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema/blog";
import { authorizeBlogAdmin } from "@/lib/blog-admin-auth";
import { SLUG_RE, validatePostInput } from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";

// Admin blog API — single-post endpoints, addressed by slug.
//
//   GET    /api/admin/blog/[slug]  → fetch one post (draft or published)
//   PUT    /api/admin/blog/[slug]  → partial update; "status":"published" publishes
//   DELETE /api/admin/blog/[slug]  → hard delete
//
// Auth + usage doc: src/lib/blog-admin-auth.ts and BLOG_API.md.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

const unauthorized = () =>
  NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
const notFound = () =>
  NextResponse.json({ ok: false, error: "No post with that slug." }, { status: 404 });

async function loadPost(slug: string) {
  if (!SLUG_RE.test(slug)) return undefined;
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return row;
}

export async function GET(req: Request, ctx: Ctx) {
  const identity = await authorizeBlogAdmin(req);
  if (!identity) return unauthorized();

  const { slug } = await ctx.params;
  const post = await loadPost(slug);
  if (!post) return notFound();
  return NextResponse.json({ ok: true, post });
}

export async function PUT(req: Request, ctx: Ctx) {
  const identity = await authorizeBlogAdmin(req);
  if (!identity) return unauthorized();

  const { slug } = await ctx.params;
  const post = await loadPost(slug);
  if (!post) return notFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = validatePostInput(body, { partial: true });
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;

  if (input.bodyMd !== undefined && renderMarkdown(input.bodyMd).trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "bodyMd rendered to empty HTML after sanitization." },
      { status: 400 },
    );
  }

  // Changing the slug of a live post would orphan its indexed URL — allow
  // it, but only onto a slug nothing else holds.
  if (input.slug && input.slug !== post.slug) {
    const [taken] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, input.slug))
      .limit(1);
    if (taken) {
      return NextResponse.json(
        { ok: false, error: `A post with slug "${input.slug}" already exists.` },
        { status: 409 },
      );
    }
  }

  const nextStatus = input.status ?? post.status;
  const publishedAt =
    input.publishedAt !== undefined
      ? input.publishedAt === null
        ? null
        : new Date(input.publishedAt)
      : nextStatus === "published" && !post.publishedAt
        ? new Date()
        : post.publishedAt;

  const [updated] = await db
    .update(blogPosts)
    .set({
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.bodyMd !== undefined ? { bodyMd: input.bodyMd } : {}),
      ...(input.heroImageUrl !== undefined ? { heroImageUrl: input.heroImageUrl } : {}),
      ...(input.heroImageAlt !== undefined ? { heroImageAlt: input.heroImageAlt } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.faq !== undefined ? { faq: input.faq } : {}),
      ...(input.author !== undefined ? { author: input.author } : {}),
      status: nextStatus,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, post.id))
    .returning();

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  return NextResponse.json({ ok: true, post: updated, url: `${base}/blog/${updated.slug}` });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const identity = await authorizeBlogAdmin(req);
  if (!identity) return unauthorized();

  const { slug } = await ctx.params;
  const post = await loadPost(slug);
  if (!post) return notFound();

  await db.delete(blogPosts).where(eq(blogPosts.id, post.id));
  return NextResponse.json({ ok: true, deleted: post.slug });
}
