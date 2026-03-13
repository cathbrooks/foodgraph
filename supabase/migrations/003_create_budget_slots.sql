-- WO11: budget_slots table + RLS policies

create table if not exists public.budget_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 100),
  days        text[] not null check (array_length(days, 1) >= 1),
  start_time  time not null,
  end_time    time not null,
  min_budget  numeric(10,2) not null check (min_budget >= 0),
  max_budget  numeric(10,2) not null check (max_budget >= min_budget),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_budget_slots_user_id on public.budget_slots(user_id);

alter table public.budget_slots enable row level security;

create policy "Users can read own budget slots"
  on public.budget_slots for select
  using (auth.uid() = user_id);

create policy "Users can insert own budget slots"
  on public.budget_slots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budget slots"
  on public.budget_slots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own budget slots"
  on public.budget_slots for delete
  using (auth.uid() = user_id);
