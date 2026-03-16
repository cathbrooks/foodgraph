-- Add distance_unit column to user_preferences (km or mi)

alter table public.user_preferences
  add column if not exists distance_unit text not null default 'km'
    check (distance_unit in ('km', 'mi'));
