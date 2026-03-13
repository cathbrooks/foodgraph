-- WO36: restaurant_cache table for caching Google Places results
-- Keyed by geohash cell + radius. Service role access only.

create table if not exists public.restaurant_cache (
  id          uuid primary key default gen_random_uuid(),
  cache_key   text not null unique,
  data        jsonb not null default '[]',
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index idx_restaurant_cache_key on public.restaurant_cache(cache_key);
create index idx_restaurant_cache_expires on public.restaurant_cache(expires_at);

alter table public.restaurant_cache enable row level security;

-- No user-level policies: only service_role can read/write.
-- App accesses via server-side createClient with service role key when needed.
