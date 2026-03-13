-- welcome_chip_cache: per-user dynamic welcome chip labels + visit counter

create table if not exists public.welcome_chip_cache (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  labels      text[] not null default '{}',
  visit_count int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.welcome_chip_cache enable row level security;

create policy "Users can read own chip cache"
  on public.welcome_chip_cache for select
  using (auth.uid() = user_id);

create policy "Users can update own chip cache"
  on public.welcome_chip_cache for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own chip cache"
  on public.welcome_chip_cache for insert
  with check (auth.uid() = user_id);
