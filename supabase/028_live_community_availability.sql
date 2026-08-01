-- Live Community votes and Kalenski pickup readiness.

create table if not exists public.empire_availability (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text not null default 'Card pickup' check (char_length(title) between 3 and 80),
  location text not null default 'DMO' check (char_length(location) between 2 and 100),
  note text not null default '' check (char_length(note) <= 600),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empire_availability_time_order check (ends_at > starts_at)
);

create index if not exists empire_availability_starts_at_idx
  on public.empire_availability(starts_at);

alter table public.empire_availability enable row level security;
grant select, insert, update, delete on public.empire_availability to authenticated;

drop policy if exists "Verified players read availability" on public.empire_availability;
create policy "Verified players read availability"
  on public.empire_availability for select
  to authenticated
  using (public.is_discord_user() or public.is_admin());

drop policy if exists "Admins manage availability" on public.empire_availability;
drop policy if exists "Admins create availability" on public.empire_availability;
create policy "Admins create availability"
  on public.empire_availability for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update availability" on public.empire_availability;
create policy "Admins update availability"
  on public.empire_availability for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete availability" on public.empire_availability;
create policy "Admins delete availability"
  on public.empire_availability for delete
  to authenticated
  using (public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_poll_votes'
  ) then
    alter publication supabase_realtime add table public.community_poll_votes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'empire_availability'
  ) then
    alter publication supabase_realtime add table public.empire_availability;
  end if;
end;
$$;