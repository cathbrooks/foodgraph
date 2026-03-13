-- Google Place Details cache table.
-- Stores enriched restaurant details from Google Places API,
-- keyed by google_place_id with a secondary index on fsq_place_id
-- for cross-provider lookups. Service role access only.

create table if not exists public.google_place_details_cache (
  google_place_id text primary key,
  fsq_place_id    text not null,
  data            jsonb not null default '{}',
  fetched_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index idx_google_details_fsq_id on public.google_place_details_cache(fsq_place_id);
create index idx_google_details_expires on public.google_place_details_cache(expires_at);

alter table public.google_place_details_cache enable row level security;
