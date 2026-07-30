-- Admin-only player profile removal.
-- This deletes the Card Empire profile and all dependent Empire data.
-- It deliberately keeps the Supabase auth record intact, so a deleted player cannot silently recreate a profile.

create or replace function public.delete_player_profile(p_player_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_role public.app_role;
begin
  if not public.is_admin() then
    raise exception 'Only Kalenski™ can remove player profiles.';
  end if;

  if p_player_id = auth.uid() then
    raise exception 'Your own administrator profile cannot be deleted here.';
  end if;

  select username, role
    into v_username, v_role
    from public.profiles
   where id = p_player_id
   for update;

  if v_username is null then
    raise exception 'Player profile not found.';
  end if;

  if v_role = 'admin' then
    raise exception 'Administrator profiles cannot be removed here.';
  end if;

  delete from public.profiles where id = p_player_id;

  return v_username;
end;
$$;

grant execute on function public.delete_player_profile(uuid) to authenticated;
