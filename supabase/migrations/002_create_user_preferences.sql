-- WO7: user_preferences table + RLS policies

create table if not exists public.user_preferences (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  cuisines              text[] not null default '{}',
  dietary_restrictions  text[] not null default '{}',
  travel_radius_km      numeric(5,2) not null default 5.0
    check (travel_radius_km >= 0.5 and travel_radius_km <= 50),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_user_preferences_user_id on public.user_preferences(user_id);

alter table public.user_preferences enable row level security;

create policy "Users can read own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

-- Auto-create default preferences on signup
create or replace function public.handle_new_user_preferences()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created_preferences
  after insert on auth.users
  for each row execute function public.handle_new_user_preferences();
