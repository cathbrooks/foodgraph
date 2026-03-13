-- WO32: user_actions table for tracking clicks, selections, and wildcard usage

create table if not exists public.user_actions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  recommendation_event_id  uuid not null references public.recommendation_events(id) on delete cascade,
  restaurant_place_id      text,
  action_type              text not null check (
    action_type in ('click', 'select', 'wildcard_request', 'wildcard_select', 'dismiss')
  ),
  metadata                 jsonb,
  created_at               timestamptz not null default now()
);

create index idx_user_actions_user_id on public.user_actions(user_id);
create index idx_user_actions_event_id on public.user_actions(recommendation_event_id);
create index idx_user_actions_created_at on public.user_actions(created_at);

alter table public.user_actions enable row level security;

create policy "Users can read own actions"
  on public.user_actions for select
  using (auth.uid() = user_id);

create policy "Users can insert own actions"
  on public.user_actions for insert
  with check (auth.uid() = user_id);
