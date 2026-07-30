-- Card Empire Vault — Supabase schema
-- Run this once in the Supabase SQL Editor.

create type public.app_role as enum ('admin', 'vip', 'potm', 'regular_customer', 'customer');
create type public.offer_status as enum ('pending', 'accepted', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  description text not null default '',
  banlist_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.banlists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  card_names text[] not null default '{}',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.events
  add constraint events_banlist_id_fkey foreign key (banlist_id) references public.banlists(id) on delete set null;

create table public.event_registrations (
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  card_name text not null,
  amount numeric(10,2) not null check (amount >= 0),
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 1000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.banlists enable row level security;
alter table public.event_registrations enable row level security;
alter table public.offers enable row level security;
alter table public.notifications enable row level security;
alter table public.feedback enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create policy "Profiles are visible to signed-in players" on public.profiles for select to authenticated using (true);
create policy "Players update their own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Signed-in players view events" on public.events for select to authenticated using (true);
create policy "Admins manage events" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Signed-in players view banlists" on public.banlists for select to authenticated using (true);
create policy "Admins manage banlists" on public.banlists for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Players view registrations" on public.event_registrations for select to authenticated using (true);
create policy "Players register themselves" on public.event_registrations for insert to authenticated with check (player_id = auth.uid());
create policy "Players cancel their registration" on public.event_registrations for delete to authenticated using (player_id = auth.uid());
create policy "Admins manage registrations" on public.event_registrations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Players view their own offers" on public.offers for select to authenticated using (player_id = auth.uid() or public.is_admin());
create policy "Players create their own offers" on public.offers for insert to authenticated with check (player_id = auth.uid());
create policy "Admins update offers" on public.offers for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Players read own notifications" on public.notifications for select to authenticated using (player_id = auth.uid());
create policy "Players update own notifications" on public.notifications for update to authenticated using (player_id = auth.uid());
create policy "Admins create notifications" on public.notifications for insert to authenticated with check (public.is_admin());

create policy "Everyone signed in sees feedback" on public.feedback for select to authenticated using (true);
create policy "Players submit feedback" on public.feedback for insert to authenticated with check (player_id = auth.uid());

create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.create_profile();

create or replace function public.notify_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (player_id, message)
  select id, case when tg_op = 'INSERT' then 'New event: ' || new.title else 'Event updated: ' || new.title end
  from public.profiles;
  return new;
end;
$$;

create trigger events_notify_players
after insert or update on public.events for each row execute procedure public.notify_event_change();

create or replace function public.notify_offer_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status <> 'pending' then
    insert into public.notifications (player_id, message)
    values (new.player_id, 'Your offer for ' || new.card_name || ' was ' || new.status || '.');
  end if;
  return new;
end;
$$;

create trigger offers_notify_player
after update on public.offers for each row execute procedure public.notify_offer_change();

create or replace function public.notify_event_registration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (player_id, message)
  values (new.player_id, 'Your event registration was confirmed.');
  return new;
end;
$$;

create trigger registrations_notify_player
after insert on public.event_registrations for each row execute procedure public.notify_event_registration();

alter publication supabase_realtime add table public.events, public.banlists, public.event_registrations, public.offers, public.notifications, public.feedback;
