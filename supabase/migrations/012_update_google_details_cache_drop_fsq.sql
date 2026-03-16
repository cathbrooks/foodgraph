-- Recreate google_place_details_cache without Foursquare dependency.
-- Uses place_id (Google Place ID) as the primary key.
-- Safe to drop and recreate since this is a cache table.

drop table if exists public.google_place_details_cache;

create table public.google_place_details_cache (
  google_place_id text primary key,
  place_id        text not null,
  data            jsonb not null default '{}',
  fetched_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create unique index idx_google_details_place_id
  on public.google_place_details_cache(place_id);

create index idx_google_details_expires
  on public.google_place_details_cache(expires_at);

alter table public.google_place_details_cache enable row level security;
