-- Minimal custom Discord identity for Card Empire.
-- Discord supplies only the mandatory `identify` scope. No email, guild, friend or message scope is requested.

alter table public.profiles
  add column if not exists discord_id text,
  add column if not exists discord_connected_at timestamptz,
  add column if not exists dmo_name text;

create unique index if not exists profiles_discord_id_unique
  on public.profiles (discord_id)
  where discord_id is not null;

create unique index if not exists profiles_dmo_name_unique
  on public.profiles (lower(dmo_name))
  where dmo_name is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_dmo_name_length'
  ) then
    alter table public.profiles
      add constraint profiles_dmo_name_length
      check (dmo_name is null or char_length(trim(dmo_name)) between 2 and 30);
  end if;
end $$;

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
    'Vault_' || left(replace(new.id::text, '-', ''), 8)
  );
  v_username := left(v_username, 30);

  if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := left(v_username, 25) || '_' || left(replace(new.id::text, '-', ''), 4);
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_discord_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and discord_id is not null
  );
$$;

grant execute on function public.is_discord_user() to authenticated;

alter table public.cards enable row level security;
drop policy if exists "Public Card Market" on public.cards;
drop policy if exists "Signed-in players see cards" on public.cards;
drop policy if exists "Discord players see cards" on public.cards;
create policy "Discord players see cards"
on public.cards for select to authenticated
using (public.is_discord_user());

create or replace function public.protect_player_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    new.username := old.username;
    new.discord_id := old.discord_id;
    new.discord_connected_at := old.discord_connected_at;
    new.role := old.role;
    new.wins := old.wins;
    new.losses := old.losses;
    new.loyalty_points := old.loyalty_points;
    new.loyalty_purchases := old.loyalty_purchases;
    new.loyalty_free_card_credits := old.loyalty_free_card_credits;
    new.vip_until := old.vip_until;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_player_profile_fields on public.profiles;
create trigger protect_player_profile_fields
before update on public.profiles
for each row execute function public.protect_player_profile_fields();
