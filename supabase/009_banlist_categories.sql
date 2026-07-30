-- Run after the existing Banlist setup.
-- Stores Banned and Limited cards separately for each banlist.

alter table public.banlists
  add column if not exists banned_cards text[] not null default '{}',
  add column if not exists limited_cards text[] not null default '{}';
