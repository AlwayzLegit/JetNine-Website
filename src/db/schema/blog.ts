import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const blogPostStatusEnum = pgEnum("blog_post_status", [
  "draft",
  "published",
]);

// ─── blog_posts ──────────────────────────────────────────────────────────
// Full articles posted through the admin blog API (/api/admin/blog) and
// rendered at /blog/[slug]. Body is stored as markdown source — the site
// converts + sanitizes at render time (src/lib/markdown.ts) so a post is
// editable as plain text and the HTML surface stays under our control.
// Anonymous read of published rows only; all writes go through the API
// (admin session or BLOG_ADMIN_API_KEY), never through PostgREST.

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // Meta description — the API caps it at 160 chars so it never truncates
    // in a SERP snippet.
    description: text("description").notNull(),

    bodyMd: text("body_md").notNull(),

    heroImageUrl: text("hero_image_url"),
    heroImageAlt: text("hero_image_alt"),

    tags: jsonb("tags").$type<string[]>().notNull().default([]),

    // Optional Q&A block rendered under the article and emitted as
    // FAQPage JSON-LD — the same "people also ask" capture the guide and
    // question pages get, but per-post.
    faq: jsonb("faq").$type<{ q: string; a: string }[]>().notNull().default([]),

    // Site convention: no invented staff names — default byline is the desk.
    author: text("author").notNull().default("JetNine dispatch desk"),

    status: blogPostStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_posts_slug_idx").on(t.slug),
    index("blog_posts_status_published_idx").on(t.status, t.publishedAt),
  ],
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
