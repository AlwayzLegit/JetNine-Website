import sharp from "sharp";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, type BlogPost } from "@/db/schema/blog";
import { BLOG_DEFAULT_AUTHOR, SLUG_RE, revalidateBlog, slugify, validatePostInput } from "@/lib/blog";
import { HERO_LIBRARY } from "@/lib/blog-hero-library";
import { pingIndexNow } from "@/lib/indexnow";
import { renderMarkdown } from "@/lib/markdown";
import { logAudit } from "@/lib/audit";
import { safeFetch } from "@/lib/safe-fetch";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditFields, type Actor } from "@/domain/actor";
import { err, ok, type Result } from "@/domain/result";

/**
 * Blog commands and queries. Shared by /api/v1/blog/* and the legacy
 * /api/admin/blog/* routes. Every write is audited (subject blog_post)
 * with the actor's key / run / approval ids.
 */

export const siteBase = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
export const postUrl = (slug: string) => `${siteBase()}/blog/${slug}`;

export type PostSummary = Pick<
  BlogPost,
  "id" | "slug" | "title" | "status" | "tags" | "author" | "publishedAt" | "updatedAt" | "createdAt"
>;

export async function listPosts(): Promise<PostSummary[]> {
  return db
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
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return row;
}

async function slugTaken(slug: string): Promise<boolean> {
  const [row] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return Boolean(row);
}

export async function createPost(actor: Actor, body: unknown): Promise<Result<{ post: BlogPost; url: string }>> {
  const parsed = validatePostInput(body, { partial: false });
  if (!parsed.ok) return err("invalid", parsed.error);
  const input = parsed.value;

  // Markdown that sanitizes to nothing would publish an empty page.
  if (renderMarkdown(input.bodyMd!).trim().length === 0) {
    return err("invalid", "bodyMd rendered to empty HTML after sanitization.");
  }
  const slug = input.slug ?? slugify(input.title!);
  if (!slug) return err("invalid", "Could not derive a slug from the title — pass one explicitly.");
  if (await slugTaken(slug)) {
    return err("conflict", `A post with slug "${slug}" already exists. Update it instead.`, { slug });
  }

  const status = input.status ?? "draft";
  const publishedAt =
    input.publishedAt != null ? new Date(input.publishedAt) : status === "published" ? new Date() : null;

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
  if (post.status === "published") await pingIndexNow(["/blog", `/blog/${post.slug}`]);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: post.status === "published" ? "blog_post.publish" : "blog_post.create",
    subjectType: "blog_post",
    subjectId: post.id,
    subjectCode: post.slug,
    metadata: { ...a.metadata, title: post.title, status: post.status },
  });

  return ok({ post, url: postUrl(post.slug) });
}

export async function updatePost(
  actor: Actor,
  slug: string,
  body: unknown,
): Promise<Result<{ post: BlogPost; url: string }>> {
  const post = await getPost(slug);
  if (!post) return err("not_found", "No post with that slug.");

  const parsed = validatePostInput(body, { partial: true });
  if (!parsed.ok) return err("invalid", parsed.error);
  const input = parsed.value;

  if (input.bodyMd !== undefined && renderMarkdown(input.bodyMd).trim().length === 0) {
    return err("invalid", "bodyMd rendered to empty HTML after sanitization.");
  }
  // Renaming a live post orphans its indexed URL — allowed, but only onto a free slug.
  if (input.slug && input.slug !== post.slug && (await slugTaken(input.slug))) {
    return err("conflict", `A post with slug "${input.slug}" already exists.`, { slug: input.slug });
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

  revalidateBlog([post.slug, updated.slug]);
  // Ping when the live surface changed: publish, edit-in-place, unpublish, slug move.
  if (post.status === "published" || updated.status === "published") {
    await pingIndexNow(["/blog", `/blog/${post.slug}`, `/blog/${updated.slug}`]);
  }

  const changed = Object.keys(input);
  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action:
      post.status !== "published" && updated.status === "published"
        ? "blog_post.publish"
        : post.status === "published" && updated.status !== "published"
          ? "blog_post.unpublish"
          : "blog_post.update",
    subjectType: "blog_post",
    subjectId: updated.id,
    subjectCode: updated.slug,
    diff: post.slug !== updated.slug ? { slug: { before: post.slug, after: updated.slug } } : null,
    metadata: { ...a.metadata, fields: changed, title: updated.title },
  });

  return ok({ post: updated, url: postUrl(updated.slug) });
}

export async function deletePost(actor: Actor, slug: string): Promise<Result<{ deleted: string }>> {
  const post = await getPost(slug);
  if (!post) return err("not_found", "No post with that slug.");

  await db.delete(blogPosts).where(eq(blogPosts.id, post.id));
  revalidateBlog([post.slug]);
  if (post.status === "published") await pingIndexNow(["/blog", `/blog/${post.slug}`]);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "blog_post.delete",
    subjectType: "blog_post",
    subjectId: post.id,
    subjectCode: post.slug,
    metadata: { ...a.metadata, title: post.title, wasPublished: post.status === "published" },
  });
  return ok({ deleted: post.slug });
}

// ─── Hero images ─────────────────────────────────────────────────────────

const HOUSE_STYLE =
  "Editorial private-aviation photograph, premium magazine aesthetic, natural light, clean composition, no text, no logos, no watermarks, no visible faces.";
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export type HeroResult = { url: string; model: string; bytes: number };

/**
 * `sourceUrl` ingests an existing https image (SSRF-guarded); `prompt`
 * generates one through the Hugging Face router when HF_TOKEN is set.
 * Either way the image becomes a 1536×864 webp in the public `blog`
 * bucket. Failures carry the hero `library` in `details` so the caller
 * can fall back without another request.
 */
export async function ingestHero(actor: Actor, body: unknown): Promise<Result<HeroResult>> {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  const sourceUrl = typeof b.sourceUrl === "string" ? b.sourceUrl.trim() : "";
  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  if (!SLUG_RE.test(slug)) return err("invalid", '"slug" must be lowercase-hyphenated.');
  if (!sourceUrl && (prompt.length < 10 || prompt.length > 1200)) {
    return err("invalid", 'Pass either "sourceUrl" (https) or a "prompt" of 10–1200 characters.');
  }

  let raw: Buffer;
  let model = "ingest";
  if (sourceUrl) {
    if (sourceUrl.length > 2000) return err("invalid", '"sourceUrl" is too long.');
    const got = await safeFetch(sourceUrl, {
      maxBytes: MAX_SOURCE_BYTES,
      accept: "image/*",
      requireContentTypePrefix: "image/",
    });
    if (!got.ok) {
      const code = got.status === 422 || got.status === 413 ? "invalid" : "unavailable";
      return err(code, `sourceUrl: ${got.error}`, { library: HERO_LIBRARY, status: got.status });
    }
    raw = got.body;
  } else {
    const token = process.env.HF_TOKEN;
    if (!token) {
      return err(
        "unavailable",
        "Image generation is not configured (HF_TOKEN unset). Pass a `sourceUrl` or pick a hero from the library.",
        { library: HERO_LIBRARY },
      );
    }
    model = process.env.BLOG_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
    const gen = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "image/*" },
      body: JSON.stringify({ inputs: `${prompt}. ${HOUSE_STYLE}`, parameters: { width: 1536, height: 864 } }),
    });
    if (!gen.ok) {
      const detail = (await gen.text()).slice(0, 300);
      return err("unavailable", `Image provider returned ${gen.status}: ${detail}`, { library: HERO_LIBRARY, status: 502 });
    }
    raw = Buffer.from(await gen.arrayBuffer());
  }

  let webp: Buffer;
  try {
    webp = await sharp(raw).resize(1536, 864, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  } catch {
    return err("invalid", "That file is not an image we can read.");
  }

  const admin = createAdminClient();
  const path = `heroes/${slug}-${Date.now().toString(36)}.webp`;
  const { error } = await admin.storage.from("blog").upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) return err("unavailable", `Storage upload failed: ${error.message}`, { status: 502 });
  const { data } = admin.storage.from("blog").getPublicUrl(path);

  const a = auditFields(actor);
  await logAudit({
    actorUserId: a.actorUserId,
    actorRole: a.actorRole,
    action: "blog_post.hero",
    subjectType: "blog_post",
    subjectCode: slug,
    metadata: { ...a.metadata, model, bytes: webp.length, source: sourceUrl ? "url" : "prompt" },
  });

  return ok({ url: data.publicUrl, model, bytes: webp.length });
}

export { HERO_LIBRARY };
