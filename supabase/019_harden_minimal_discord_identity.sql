-- Follow-up for installations that ran an earlier version of 018.

create or replace function public.protect_player_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if session_user <> 'postgres'
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_admin() then
    new.id := old.id;
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

drop policy if exists "Players update their own profile" on public.profiles;
create policy "Players update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Profiles are visible to signed-in players" on public.profiles;
drop policy if exists "Profiles are visible to verified players" on public.profiles;
create policy "Profiles are visible to verified players"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or public.is_discord_user() or public.is_admin());

