-- Secure Wishlist -> in-app + Discord notification pipeline.
-- The webhook secret stays behind RLS and is read only by Postgres and service_role.

create table if not exists public.integration_secrets (
  name text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from public, anon, authenticated;
grant select on public.integration_secrets to service_role;
drop policy if exists "No client access to integration secrets" on public.integration_secrets;
create policy "No client access to integration secrets"
on public.integration_secrets for all
to anon, authenticated
using (false)
with check (false);

insert into public.integration_secrets (name, secret)
values ('wishlist_webhook', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

alter table public.wishlists
  add column if not exists availability_notifications integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wishlists_availability_notifications_check'
      and conrelid = 'public.wishlists'::regclass
  ) then
    alter table public.wishlists
      add constraint wishlists_availability_notifications_check
      check (availability_notifications >= 0);
  end if;
end $$;

update public.wishlists w
set availability_notifications = greatest(w.availability_notifications, 1)
from public.cards c
where c.id = w.card_id and c.quantity > 0;

alter table public.discord_notification_queue
  add column if not exists card_id uuid,
  add column if not exists event_type text not null default 'wishlist_update';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'discord_notification_queue_card_id_fkey'
      and conrelid = 'public.discord_notification_queue'::regclass
  ) then
    alter table public.discord_notification_queue
      add constraint discord_notification_queue_card_id_fkey
      foreign key (card_id) references public.cards(id) on delete set null;
  end if;
end $$;

alter table public.discord_notification_queue
  drop constraint if exists discord_notification_queue_status_check;
alter table public.discord_notification_queue
  add constraint discord_notification_queue_status_check
  check (status in ('pending', 'processing', 'sent', 'waiting_configuration', 'failed'));

alter table public.discord_notification_queue
  drop constraint if exists discord_notification_queue_event_type_check;
alter table public.discord_notification_queue
  add constraint discord_notification_queue_event_type_check
  check (event_type in ('wishlist_update', 'available', 'available_again', 'sold'));

create index if not exists discord_notification_queue_status_idx
  on public.discord_notification_queue(status, created_at)
  where status <> 'sent';

create or replace function public.prepare_wishlist_availability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  select case when c.quantity > 0 then 1 else 0 end
    into new.availability_notifications
  from public.cards c
  where c.id = new.card_id;
  return new;
end;
$$;

revoke execute on function public.prepare_wishlist_availability() from public, anon, authenticated;
drop trigger if exists prepare_wishlist_availability_before_insert on public.wishlists;
create trigger prepare_wishlist_availability_before_insert
before insert on public.wishlists
for each row execute function public.prepare_wishlist_availability();

create or replace function public.create_wishlist_stock_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_target record;
  v_message text;
  v_event_type text;
  v_notification_id uuid;
begin
  if old.quantity = new.quantity then return new; end if;

  if old.quantity > 0 and new.quantity <= 0 then
    v_event_type := 'sold';
  elsif old.quantity <= 0 and new.quantity > 0 then
    v_event_type := 'available';
  else
    return new;
  end if;

  for v_target in
    select w.id, w.player_id, w.availability_notifications, p.discord_id
    from public.wishlists w
    join public.profiles p on p.id = w.player_id
    where w.card_id = new.id
  loop
    if v_event_type = 'sold' then
      v_message := 'Wishlist update - ' || new.name || ' has been sold. You will be notified if it returns.';
    elsif v_target.availability_notifications > 0 then
      v_event_type := 'available_again';
      v_message := 'Wishlist restock - ' || new.name || ' is available again in Cardstock.';
    else
      v_event_type := 'available';
      v_message := 'Wishlist available - ' || new.name || ' is now available in Cardstock.';
    end if;

    insert into public.notifications (player_id, message)
    values (v_target.player_id, v_message)
    returning id into v_notification_id;

    if nullif(trim(v_target.discord_id), '') is not null then
      insert into public.discord_notification_queue
        (notification_id, player_id, discord_id, card_id, event_type, body)
      values
        (v_notification_id, v_target.player_id, v_target.discord_id, new.id, v_event_type, v_message);
    end if;

    if v_event_type in ('available', 'available_again') then
      update public.wishlists
      set availability_notifications = availability_notifications + 1
      where id = v_target.id;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.create_wishlist_stock_notifications() from public, anon, authenticated;
drop trigger if exists wishlist_stock_notifications on public.cards;
create trigger wishlist_stock_notifications
after update of quantity on public.cards
for each row execute function public.create_wishlist_stock_notifications();

create or replace function public.dispatch_discord_queue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, net
as $$
declare
  v_secret text;
begin
  select secret into v_secret
  from public.integration_secrets
  where name = 'wishlist_webhook';

  if v_secret is null then
    update public.discord_notification_queue
    set status = 'failed', last_error = 'Wishlist webhook secret is missing.'
    where id = new.id;
    return new;
  end if;

  perform net.http_post(
    url := 'https://ewpqnrhhrqvlywmdbral.supabase.co/functions/v1/wishlist-discord',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cardstock-hook-secret', v_secret
    ),
    body := jsonb_build_object('queue_id', new.id),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

revoke execute on function public.dispatch_discord_queue() from public, anon, authenticated;
drop trigger if exists dispatch_discord_queue_after_insert on public.discord_notification_queue;
create trigger dispatch_discord_queue_after_insert
after insert on public.discord_notification_queue
for each row execute function public.dispatch_discord_queue();
