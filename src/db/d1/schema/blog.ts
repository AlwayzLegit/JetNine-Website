// D1 (SQLite) twin of src/db/schema/blog.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId } from "../helpers";
import { blogPostStatusEnum } from "../../schema/blog";


// ─── blog_posts ──────────────────────────────────────────────────────────
// Full articles posted through the admin blog API (/api/admin/blog) and
// rendered at /blog/[slug]. Body is stored as markdown source — the site
// converts + sanitizes at render time (src/lib/markdown.ts) so a post is
// editable as plain text and the HTML surface stays under our control.
// Anonymous read of published rows only; all writes go through the API
// (admin session or BLOG_ADMIN_API_KEY), never through PostgREST.

export const blogPosts = sqliteTable(
  "blog_posts",
  {
    id: text("id").primaryKey().$defaultFn(newId),

    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // Meta description — the API caps it at 160 chars so it never truncates
    // in a SERP snippet.
    description: text("description").notNull(),

    bodyMd: text("body_md").notNull(),

    heroImageUrl: text("hero_image_url"),
    heroImageAlt: text("hero_image_alt"),

    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),

    // Optional Q&A block rendered under the article and emitted as
    // FAQPage JSON-LD — the same "people also ask" capture the guide and
    // question pages get, but per-post.
    faq: text("faq", { mode: "json" }).$type<{ q: string; a: string }[]>().notNull().default([]),

    // Site convention: no invented staff names — default byline is the desk.
    author: text("author").notNull().default("JetNine dispatch desk"),

    status: text("status", { enum: blogPostStatusEnum.enumValues }).notNull().default("draft"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_posts_slug_idx").on(t.slug),
    index("blog_posts_status_published_idx").on(t.status, t.publishedAt),
    enumCheck("blog_posts_status_enum", t.status, blogPostStatusEnum.enumValues),
  ]);

