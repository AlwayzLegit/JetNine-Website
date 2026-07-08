-- Sourced options — the Avinode-sourced airframes a dispatcher attaches to
-- a quote during its `sourcing` state (see src/db/schema/sourced-option.ts).
-- Avinode has no API, so options are pasted in and reconciled against the
-- operators table to enforce the safety floor and apply markup.
--
-- This is internal broker data (operator cost, seller identity) with no
-- member-facing surface, so RLS mirrors stripe_webhook_events (revoke anon)
-- + contact_inquiries (staff-only select/mutate via public.is_staff()).
-- Server actions write through the service-role client, which bypasses RLS.

create type "public"."sourced_option_status" as enum(
  'sourced', 'shortlisted', 'sent_to_client', 'accepted', 'rejected'
);
create type "public"."markup_type" as enum('percent', 'flat');

create table "public"."sourced_options" (
  "id" uuid primary key default gen_random_uuid() not null,
  "quote_id" uuid not null references public.quotes(id) on delete cascade,
  "option_number" integer not null,
  "avinode_ref" text,

  "aircraft_type" text,
  "tail_number" text,
  "is_floating_fleet" boolean default false not null,
  "year_of_make" integer,
  "category" "public"."aircraft_category",
  "pax_capacity" integer,
  "refurb_interior_year" integer,
  "refurb_exterior_year" integer,

  "operator_name_raw" text,
  "operator_id" uuid references public.operators(id) on delete set null,
  "operator_matched" boolean default false not null,
  "argus_rating" "public"."operator_vetting_argus",
  "wyvern_wingman" boolean,
  "isbao_stage" integer,
  "safety_floor_passed" boolean default false not null,

  "positioning_time_min" integer,
  "positioning_airport" text,
  "total_flight_time_min" integer,

  "operator_cost_usd" integer,
  "markup_type" "public"."markup_type" default 'percent' not null,
  "markup_value" numeric(10, 2),
  "client_price_usd" integer,
  "soft_hold_expiry" timestamptz,

  "status" "public"."sourced_option_status" default 'sourced' not null,
  "is_chosen" boolean default false not null,
  "dispatcher_notes" text,

  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

create unique index "sourced_options_quote_option_uq"
  on public.sourced_options ("quote_id", "option_number");
create index "sourced_options_quote_idx"
  on public.sourced_options ("quote_id");

create trigger "sourced_options_set_updated_at"
  before update on public.sourced_options
  for each row execute function public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────

alter table public.sourced_options enable row level security;
revoke all on public.sourced_options from anon;

create policy "sourced_options_staff_select" on public.sourced_options
  for select to authenticated
  using (public.is_staff());

create policy "sourced_options_staff_all" on public.sourced_options
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
