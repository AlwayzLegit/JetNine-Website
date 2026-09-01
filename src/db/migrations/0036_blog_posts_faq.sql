-- Per-post FAQ block (rendered + FAQPage JSON-LD). Additive, defaulted,
-- so existing rows need no backfill.
alter table public.blog_posts
  add column if not exists "faq" jsonb default '[]'::jsonb not null;
