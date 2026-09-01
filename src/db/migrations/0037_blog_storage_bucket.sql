-- Public storage bucket for blog hero images generated through
-- /api/admin/blog/image. Public read (served by URL); writes only via the
-- service-role client from the API route — no anon/authenticated object
-- policies are created.
insert into storage.buckets (id, name, public)
values ('blog', 'blog', true)
on conflict (id) do nothing;
