-- Contact-form inquiries.
--
-- The public /contact form previously validated client-side and dropped
-- the submission on the floor. This table gives it a real landing spot:
-- anonymous insert (RLS mirrors empty_leg_watchlists), staff-only read
-- and triage. Quote-shaped inquiries stay out of `quotes` on purpose —
-- they arrive without legs or consent flags, and dispatch walks the
-- caller into the wizard when the trip firms up.

create type "public"."contact_reason" as enum('quote', 'card', 'trip', 'other');
create type "public"."contact_inquiry_status" as enum('new', 'handled');

-- Audit rows for inquiries need their own subject type. ADD VALUE is
-- safe here because this migration only declares it — first use happens
-- at runtime, well after commit.
alter type "public"."audit_subject_type" add value if not exists 'contact_inquiry';

create table "public"."contact_inquiries" (
  "id" uuid primary key default gen_random_uuid() not null,
  "reason" "contact_reason" default 'quote' not null,
  "first_name" text not null,
  "last_name" text not null,
  "email" text not null,
  "phone" text,
  "from_text" text,
  "to_text" text,
  "date_text" text,
  "pax_text" text,
  "notes" text,
  "member_id" uuid references public.members(id) on delete set null,
  "status" "contact_inquiry_status" default 'new' not null,
  "handled_by_user_id" uuid references public.users(id) on delete set null,
  "handled_at" timestamptz,
  "created_at" timestamptz default now() not null
);

create index "contact_inquiries_status_idx"
  on public.contact_inquiries ("status", "created_at");
create index "contact_inquiries_email_idx"
  on public.contact_inquiries ("email");

-- ─── RLS ─────────────────────────────────────────────────────────────────

alter table public.contact_inquiries enable row level security;

-- Anonymous visitors insert with no member linkage and no triage fields —
-- everything else (status, handled_*) must stay at column defaults.
create policy "contact_inquiries_anon_insert" on public.contact_inquiries
  for insert to anon
  with check (
    member_id is null
    and status = 'new'
    and handled_by_user_id is null
    and handled_at is null
  );

-- Signed-in visitors may link their own member profile (or none).
create policy "contact_inquiries_self_insert" on public.contact_inquiries
  for insert to authenticated
  with check (
    (
      member_id is null
      or member_id in (select id from public.members where user_id = (select auth.uid()))
    )
    and status = 'new'
    and handled_by_user_id is null
    and handled_at is null
  );

-- Reads + triage are desk-only. No member-facing surface lists inquiries,
-- so there's no self-select policy to maintain.
create policy "contact_inquiries_staff_select" on public.contact_inquiries
  for select to authenticated
  using (public.is_staff());

create policy "contact_inquiries_staff_update" on public.contact_inquiries
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
