-- Blog posts.
--
-- Full articles posted through the admin blog API (/api/admin/blog) and
-- rendered server-side at /blog/[slug]. Body is markdown source; the site
-- converts and sanitizes at render time. Writes never go through
-- PostgREST — the API route (admin session or BLOG_ADMIN_API_KEY) uses
-- the direct connection — so RLS here only has to protect reads: anyone
-- may read published posts, staff may read drafts, and there are no
-- anon/authenticated write policies at all.

create type "public"."blog_post_status" as enum('draft', 'published');

create table "public"."blog_posts" (
  "id" uuid primary key default gen_random_uuid() not null,
  "slug" text not null,
  "title" text not null,
  "description" text not null,
  "body_md" text not null,
  "hero_image_url" text,
  "hero_image_alt" text,
  "tags" jsonb default '[]'::jsonb not null,
  "author" text default 'JetNine dispatch desk' not null,
  "status" "blog_post_status" default 'draft' not null,
  "published_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create unique index "blog_posts_slug_idx" on public.blog_posts ("slug");
create index "blog_posts_status_published_idx"
  on public.blog_posts ("status", "published_at");

-- ─── RLS ─────────────────────────────────────────────────────────────────

alter table public.blog_posts enable row level security;

-- Published posts are public content — the marketing site reads them
-- anonymously.
create policy "blog_posts_public_select" on public.blog_posts
  for select to anon, authenticated
  using (status = 'published');

-- Drafts are desk-only.
create policy "blog_posts_staff_select_drafts" on public.blog_posts
  for select to authenticated
  using (public.is_staff());

-- No insert/update/delete policies on purpose: all writes flow through
-- the admin API on the direct connection (table owner), never PostgREST.
