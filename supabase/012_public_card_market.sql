-- Run this once in the Supabase SQL Editor.
-- Makes the Card Market and the five-card homepage preview visible without an account.
-- Purchases, offers, chats and all admin actions still require authentication.

alter table public.cards enable row level security;

drop policy if exists "Signed-in players see cards" on public.cards;
drop policy if exists "Public Card Market" on public.cards;

create policy "Public Card Market"
on public.cards
for select
to anon, authenticated
using (true);
