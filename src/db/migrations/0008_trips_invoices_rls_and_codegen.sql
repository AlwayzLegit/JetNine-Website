-- Phase C.2: code generators + RLS + the quotes.converted_trip_id FK.

-- ─── 1. trip_code generator: JN-YYYY-NNNN ────────────────────────────────

create or replace function public.next_trip_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr int := extract(year from now())::int;
  n int;
begin
  insert into public.trip_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.trip_code_sequence.last_value + 1
  returning last_value into n;
  return 'JN-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function public.trips_set_default_code()
returns trigger
language plpgsql
as $$
begin
  if new.trip_code is null or new.trip_code = '' then
    new.trip_code := public.next_trip_code();
  end if;
  return new;
end;
$$;

create trigger trips_default_trip_code
  before insert on public.trips
  for each row execute function public.trips_set_default_code();

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ─── 2. invoice_code generator: INV-YYYY-NNNN ────────────────────────────

create or replace function public.next_invoice_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr int := extract(year from now())::int;
  n int;
begin
  insert into public.invoice_code_sequence (year, last_value)
  values (yr, 1)
  on conflict (year)
  do update set last_value = public.invoice_code_sequence.last_value + 1
  returning last_value into n;
  return 'INV-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function public.invoices_set_default_code()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_code is null or new.invoice_code = '' then
    new.invoice_code := public.next_invoice_code();
  end if;
  return new;
end;
$$;

create trigger invoices_default_invoice_code
  before insert on public.invoices
  for each row execute function public.invoices_set_default_code();

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ─── 3. Quote → trip linkage FK ──────────────────────────────────────────

alter table public.quotes
  add constraint quotes_converted_trip_fk
  foreign key (converted_trip_id)
  references public.trips(id)
  on delete set null;

-- ─── 4. RLS ──────────────────────────────────────────────────────────────

alter table public.trips enable row level security;
alter table public.trip_legs enable row level security;
alter table public.invoices enable row level security;
alter table public.trip_code_sequence enable row level security;
alter table public.invoice_code_sequence enable row level security;
-- code-sequence tables locked down — only SECURITY DEFINER fns can touch.

-- trips
create policy "trips_select_owner_or_staff" on public.trips
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "trips_staff_all" on public.trips
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- trip_legs (piggyback off parent trip)
create policy "trip_legs_select" on public.trip_legs
  for select to authenticated
  using (
    trip_id in (
      select id from public.trips
      where member_id in (select id from public.members where user_id = auth.uid())
         or public.is_staff()
    )
  );

create policy "trip_legs_staff_all" on public.trip_legs
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- invoices
create policy "invoices_select_owner_or_staff" on public.invoices
  for select to authenticated
  using (
    member_id in (select id from public.members where user_id = auth.uid())
    or public.is_staff()
  );

create policy "invoices_staff_all" on public.invoices
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
