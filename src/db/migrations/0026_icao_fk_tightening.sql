-- Phase B.2 wrap-up: tighten ICAO columns on the four leg / block tables
-- to FK `public.airports.icao`. Open item from the README that was
-- intentionally deferred until the catalog stabilized.
--
-- Pre-check (run before applying):
--   Zero orphan ICAOs across all 4 tables × 2 ICAO columns each — every
--   live ICAO reference resolves against the 43-airport seed.
--
-- ON UPDATE CASCADE — rare, but if an airport's ICAO needs correction,
-- references follow.
-- ON DELETE: SET NULL where the column is nullable (quote_legs / trip_legs /
-- aircraft_schedule_blocks — preserve history if the airport is retired).
-- RESTRICT on empty_legs because from_icao / to_icao are NOT NULL there;
-- an empty leg without an origin or destination is nonsensical, so block
-- the hard delete and force ops to use `airports.active = false` instead.

alter table public.quote_legs
  add constraint quote_legs_from_icao_fk
    foreign key (from_icao) references public.airports(icao)
    on update cascade on delete set null,
  add constraint quote_legs_to_icao_fk
    foreign key (to_icao) references public.airports(icao)
    on update cascade on delete set null;

alter table public.trip_legs
  add constraint trip_legs_from_icao_fk
    foreign key (from_icao) references public.airports(icao)
    on update cascade on delete set null,
  add constraint trip_legs_to_icao_fk
    foreign key (to_icao) references public.airports(icao)
    on update cascade on delete set null;

alter table public.empty_legs
  add constraint empty_legs_from_icao_fk
    foreign key (from_icao) references public.airports(icao)
    on update cascade on delete restrict,
  add constraint empty_legs_to_icao_fk
    foreign key (to_icao) references public.airports(icao)
    on update cascade on delete restrict;

alter table public.aircraft_schedule_blocks
  add constraint asb_from_icao_fk
    foreign key (from_icao) references public.airports(icao)
    on update cascade on delete set null,
  add constraint asb_to_icao_fk
    foreign key (to_icao) references public.airports(icao)
    on update cascade on delete set null;

-- Covering indexes on the FK columns — clears the
-- `unindexed_foreign_keys` perf lint and keeps cascading updates fast.

create index if not exists quote_legs_from_icao_idx on public.quote_legs (from_icao);
create index if not exists quote_legs_to_icao_idx   on public.quote_legs (to_icao);
create index if not exists trip_legs_from_icao_idx  on public.trip_legs (from_icao);
create index if not exists trip_legs_to_icao_idx    on public.trip_legs (to_icao);
create index if not exists empty_legs_from_icao_idx on public.empty_legs (from_icao);
create index if not exists empty_legs_to_icao_idx   on public.empty_legs (to_icao);
create index if not exists asb_from_icao_idx        on public.aircraft_schedule_blocks (from_icao);
create index if not exists asb_to_icao_idx          on public.aircraft_schedule_blocks (to_icao);
