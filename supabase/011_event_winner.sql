-- Run this once in the Supabase SQL Editor after the existing Empire migrations.
-- Lets an administrator select one registered player as the event winner.

alter table public.events
  add column if not exists winner_id uuid references public.profiles(id) on delete set null;

create or replace function public.set_event_winner(
  p_event_id uuid,
  p_winner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_winner uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select winner_id
    into existing_winner
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'Event not found.';
  end if;

  if existing_winner is not null then
    raise exception 'This event already has a winner.';
  end if;

  if not exists (
    select 1
      from public.event_registrations
     where event_id = p_event_id
       and player_id = p_winner_id
  ) then
    raise exception 'The selected player is not registered for this event.';
  end if;

  update public.events
     set winner_id = p_winner_id
   where id = p_event_id;

  update public.profiles
     set wins = wins + 1
   where id = p_winner_id;

  insert into public.notifications (player_id, message)
  values (p_winner_id, 'Victory confirmed — you won an Empire event and received +1 win.');
end;
$$;

grant execute on function public.set_event_winner(uuid, uuid) to authenticated;
