-- Run once after the existing Card Empire migrations.
-- Makes Discord the only accepted Card Market identity and lets players clean up their own notifications.

create or replace function public.is_discord_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'provider' = 'discord', false)
    or coalesce((auth.jwt() -> 'app_metadata' -> 'providers') ? 'discord', false);
$$;

grant execute on function public.is_discord_user() to authenticated;

alter table public.cards enable row level security;

drop policy if exists "Public Card Market" on public.cards;
drop policy if exists "Signed-in players see cards" on public.cards;
drop policy if exists "Discord players see cards" on public.cards;

create policy "Discord players see cards"
on public.cards
for select
to authenticated
using (public.is_discord_user());

drop policy if exists "Players delete own notifications" on public.notifications;

create policy "Players delete own notifications"
on public.notifications
for delete
to authenticated
using (player_id = auth.uid());

create or replace function public.create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    'Discord Player'
  );

  if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := left(v_username, 24) || '_' || left(replace(new.id::text, '-', ''), 4);
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username)
  on conflict (id) do nothing;

  return new;
end;
$$;
