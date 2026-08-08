-- Explicit live presence for the public navigation ticker.

begin;

create table if not exists public.empire_presence (
  singleton boolean primary key default true check (singleton),
  is_online boolean not null default false,
  status_note text not null default 'Kalenski is online now.' check (char_length(status_note) between 3 and 120),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.empire_presence (singleton, is_online)
values (true, false)
on conflict (singleton) do nothing;

alter table public.empire_presence enable row level security;
grant select on public.empire_presence to anon, authenticated;
grant insert, update on public.empire_presence to authenticated;

drop policy if exists "Everyone reads Empire presence" on public.empire_presence;
create policy "Everyone reads Empire presence"
  on public.empire_presence for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins create Empire presence" on public.empire_presence;
create policy "Admins create Empire presence"
  on public.empire_presence for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update Empire presence" on public.empire_presence;
create policy "Admins update Empire presence"
  on public.empire_presence for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Everyone reads pickup windows" on public.empire_availability;
create policy "Everyone reads pickup windows"
  on public.empire_availability for select
  to anon, authenticated
  using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'empire_presence'
  ) then
    alter publication supabase_realtime add table public.empire_presence;
  end if;
end;
$$;

commit;
