-- WO31: recommendation_events table

create table if not exists public.recommendation_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  slot_id          uuid references public.budget_slots(id) on delete set null,
  location_lat     double precision not null,
  location_lng     double precision not null,
  results          jsonb not null default '[]',
  candidate_count  integer not null default 0,
  filters_applied  jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create index idx_recommendation_events_user_id on public.recommendation_events(user_id);
create index idx_recommendation_events_created_at on public.recommendation_events(created_at);

alter table public.recommendation_events enable row level security;

create policy "Users can read own recommendation events"
  on public.recommendation_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own recommendation events"
  on public.recommendation_events for insert
  with check (auth.uid() = user_id);
