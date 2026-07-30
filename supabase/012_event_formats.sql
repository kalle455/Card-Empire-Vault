-- Event formats and protected registration capacity
-- Run this after 011_event_winner.sql in Supabase SQL Editor.

alter table public.events
  add column if not exists event_format text not null default 'open';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_event_format_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_event_format_check
      check (event_format in ('open', 'five_way_ffa', 'six_way_ffa', 'three_way_ffa', 'four_way_ffa'));
  end if;
end $$;

create or replace function public.event_capacity(p_event_format text)
returns integer
language sql
immutable
as $$
  select case p_event_format
    when 'five_way_ffa' then 5
    when 'six_way_ffa' then 6
    when 'three_way_ffa' then 6
    when 'four_way_ffa' then 8
    else null
  end;
$$;

create or replace function public.register_for_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_format text;
  capacity integer;
  registration_count integer;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before registering.';
  end if;

  select event_format
    into chosen_format
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'This event no longer exists.';
  end if;

  if exists (
    select 1
      from public.event_registrations
     where event_id = p_event_id
       and player_id = auth.uid()
  ) then
    raise exception 'You are already registered for this event.';
  end if;

  capacity := public.event_capacity(chosen_format);

  if capacity is not null then
    select count(*)
      into registration_count
      from public.event_registrations
     where event_id = p_event_id;

    if registration_count >= capacity then
      raise exception 'This event is full.';
    end if;
  end if;

  insert into public.event_registrations (event_id, player_id)
  values (p_event_id, auth.uid());
end;
$$;

grant execute on function public.register_for_event(uuid) to authenticated;

drop policy if exists "Players register themselves" on public.event_registrations;
create policy "Players register through event flow"
on public.event_registrations
for insert
to authenticated
with check (false);
