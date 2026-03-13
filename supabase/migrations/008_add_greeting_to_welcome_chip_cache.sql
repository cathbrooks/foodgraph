-- Add a greeting column to rotate the welcome headline
alter table public.welcome_chip_cache
  add column if not exists greeting text not null default 'Hungry?';
