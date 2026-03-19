-- Add onboarding_completed flag to profiles.
-- New users start with false; set to true after completing the onboarding chat.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
