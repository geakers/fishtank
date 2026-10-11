-- Run this once in the Fishtank Supabase SQL editor.
-- Adds the account-wide focus timer shared by the phone and desktop apps.
-- Desktop stats use the same unit (milliseconds) as `totalFocusMs`.

alter table public.profiles
  add column if not exists focus_ms bigint not null default 0;

comment on column public.profiles.focus_ms is
  'Total completed focus time in milliseconds. Phone and desktop add to this after each finished session.';
