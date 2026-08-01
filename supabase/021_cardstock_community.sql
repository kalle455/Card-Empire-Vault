-- Cardstock profile, wishlist, community and Discord notification foundation.
-- All exposed tables use RLS. Discord delivery runs through a server-side Edge Function.

alter table public.profiles
  add column if not exists xp integer not null default 0;

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_id, card_id)
);

create table if not exists public.community_suggestions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 90),
  body text not null check (char_length(trim(body)) between 8 and 1600),
  status text not null default 'planned'
    check (status in ('planned', 'in_development', 'released', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_suggestion_votes (
  suggestion_id uuid not null references public.community_suggestions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (suggestion_id, player_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.community_suggestions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 900),
  created_at timestamptz not null default now()
);

create table if not exists public.community_reviews (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(trim(body)) between 3 and 1200),
  created_at timestamptz not null default now()
);

create table if not exists public.community_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 100),
  body text not null check (char_length(trim(body)) between 3 and 1800),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.community_polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(trim(question)) between 3 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.community_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.community_polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  position smallint not null default 0
);

create table if not exists public.community_poll_votes (
  poll_id uuid not null references public.community_polls(id) on delete cascade,
  option_id uuid not null references public.community_poll_options(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, player_id)
);

create table if not exists public.discord_notification_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  discord_id text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'waiting_configuration', 'failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.wishlists enable row level security;
alter table public.community_suggestions enable row level security;
alter table public.community_suggestion_votes enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reviews enable row level security;
alter table public.community_announcements enable row level security;
alter table public.community_polls enable row level security;
alter table public.community_poll_options enable row level security;
alter table public.community_poll_votes enable row level security;
alter table public.discord_notification_queue enable row level security;

grant select, insert, delete on public.wishlists to authenticated;
grant select, insert, update, delete on public.community_suggestions to authenticated;
grant select, insert, update, delete on public.community_suggestion_votes to authenticated;
grant select, insert, delete on public.community_comments to authenticated;
grant select, insert, update, delete on public.community_reviews to authenticated;
grant select, insert, update, delete on public.community_announcements, public.community_polls, public.community_poll_options to authenticated;
grant select, insert, update on public.community_poll_votes to authenticated;
grant select on public.discord_notification_queue to authenticated;

drop policy if exists "Players manage own wishlist" on public.wishlists;
create policy "Players read own wishlist" on public.wishlists for select to authenticated
using ((select auth.uid()) = player_id or public.is_admin());
create policy "Players add own wishlist" on public.wishlists for insert to authenticated
with check ((select auth.uid()) = player_id and public.is_discord_user());
create policy "Players remove own wishlist" on public.wishlists for delete to authenticated
using ((select auth.uid()) = player_id or public.is_admin());

create policy "Verified players read suggestions" on public.community_suggestions for select to authenticated
using (public.is_discord_user() or public.is_admin());
create policy "Verified players create suggestions" on public.community_suggestions for insert to authenticated
with check ((select auth.uid()) = player_id and public.is_discord_user());
create policy "Admins update suggestions" on public.community_suggestions for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete suggestions" on public.community_suggestions for delete to authenticated
using (public.is_admin());

create policy "Verified players read suggestion votes" on public.community_suggestion_votes for select to authenticated
using (public.is_discord_user() or public.is_admin());
create policy "Players create own suggestion vote" on public.community_suggestion_votes for insert to authenticated
with check ((select auth.uid()) = player_id and public.is_discord_user());
create policy "Players update own suggestion vote" on public.community_suggestion_votes for update to authenticated
using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);
create policy "Players delete own suggestion vote" on public.community_suggestion_votes for delete to authenticated
using ((select auth.uid()) = player_id or public.is_admin());

create policy "Verified players read comments" on public.community_comments for select to authenticated
using (public.is_discord_user() or public.is_admin());
create policy "Verified players create comments" on public.community_comments for insert to authenticated
with check ((select auth.uid()) = player_id and public.is_discord_user());
create policy "Players delete own comments" on public.community_comments for delete to authenticated
using ((select auth.uid()) = player_id or public.is_admin());

create policy "Verified players read reviews" on public.community_reviews for select to authenticated
using (public.is_discord_user() or public.is_admin());
create policy "Verified players create reviews" on public.community_reviews for insert to authenticated
with check ((select auth.uid()) = player_id and public.is_discord_user());
create policy "Players update own reviews" on public.community_reviews for update to authenticated
using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);
create policy "Players delete own reviews" on public.community_reviews for delete to authenticated
using ((select auth.uid()) = player_id or public.is_admin());

create policy "Verified players read announcements" on public.community_announcements for select to authenticated
using ((published and public.is_discord_user()) or public.is_admin());
create policy "Admins manage announcements" on public.community_announcements for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Verified players read polls" on public.community_polls for select to authenticated
using (public.is_discord_user() or public.is_admin());
create policy "Admins manage polls" on public.community_polls for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Verified players read poll options" on public.community_poll_options for select to authenticated
using (public.is_discord_user() or public.is_admin());
create policy "Admins manage poll options" on public.community_poll_options for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Verified players read poll votes" on public.community_poll_votes for select to authenticated
using (public.is_discord_user() or public.is_admin());
create policy "Players create own poll vote" on public.community_poll_votes for insert to authenticated
with check ((select auth.uid()) = player_id and public.is_discord_user());
create policy "Players change own poll vote" on public.community_poll_votes for update to authenticated
using ((select auth.uid()) = player_id) with check ((select auth.uid()) = player_id);

create policy "Admins inspect Discord queue" on public.discord_notification_queue for select to authenticated
using (public.is_admin());

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
    new.xp := old.xp;
    new.loyalty_points := old.loyalty_points;
    new.loyalty_purchases := old.loyalty_purchases;
    new.loyalty_free_card_credits := old.loyalty_free_card_credits;
    new.vip_until := old.vip_until;
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_player_profile_fields() from public, anon, authenticated;

create or replace function public.start_purchase_chat(p_card_summary text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_buyer_name text;
  v_card_summary text := left(trim(coalesce(p_card_summary, '')), 800);
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if v_card_summary = '' then raise exception 'A card summary is required.'; end if;

  insert into public.purchase_chats (buyer_id, card_summary)
  values (auth.uid(), v_card_summary)
  returning id into v_chat_id;

  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (
    v_chat_id,
    null,
    $message$Thank you for your order! I'll be with you shortly and process everything as soon as possible. Thank you for choosing Card Empire!$message$,
    true
  );

  select username into v_buyer_name from public.profiles where id = auth.uid();
  insert into public.notifications (player_id, message)
  select id, 'New purchase chat from ' || coalesce(v_buyer_name, 'a player') || ': ' || v_card_summary
  from public.profiles where role = 'admin';
  return v_chat_id;
end;
$$;
revoke execute on function public.start_purchase_chat(text) from public, anon;
grant execute on function public.start_purchase_chat(text) to authenticated;

create or replace function public.award_purchase_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gain integer := greatest(10, floor(new.paid_gold / 1000)::integer * 2);
begin
  update public.profiles
  set xp = xp + v_gain,
      role = case
        when role = 'customer' and xp + v_gain >= 900 then 'regular_customer'
        else role
      end
  where id = new.player_id;
  return new;
end;
$$;
revoke execute on function public.award_purchase_xp() from public, anon, authenticated;
drop trigger if exists award_purchase_xp_after_sale on public.purchases;
create trigger award_purchase_xp_after_sale
after insert on public.purchases
for each row execute function public.award_purchase_xp();

create or replace function public.create_wishlist_stock_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
begin
  if old.quantity = new.quantity then return new; end if;
  if old.quantity > 0 and new.quantity <= 0 then
    v_message := 'Wishlist update · ' || new.name || ' has been sold.';
  elsif old.quantity <= 0 and new.quantity > 0 then
    v_message := 'Wishlist available · ' || new.name || ' is available again in Cardstock.';
  else
    return new;
  end if;

  with created as (
    insert into public.notifications (player_id, message)
    select w.player_id, v_message
    from public.wishlists w where w.card_id = new.id
    returning id, player_id, message
  )
  insert into public.discord_notification_queue (notification_id, player_id, discord_id, body)
  select c.id, c.player_id, p.discord_id, c.message
  from created c join public.profiles p on p.id = c.player_id
  where p.discord_id is not null;
  return new;
end;
$$;
revoke execute on function public.create_wishlist_stock_notifications() from public, anon, authenticated;
drop trigger if exists wishlist_stock_notifications on public.cards;
create trigger wishlist_stock_notifications
after update of quantity on public.cards
for each row execute function public.create_wishlist_stock_notifications();

create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_discord_queue()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  perform net.http_post(
    url := 'https://ewpqnrhhrqvlywmdbral.supabase.co/functions/v1/wishlist-discord',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('record', to_jsonb(new)),
    timeout_milliseconds := 4000
  );
  return new;
end;
$$;
revoke execute on function public.dispatch_discord_queue() from public, anon, authenticated;
drop trigger if exists dispatch_discord_queue_after_insert on public.discord_notification_queue;
create trigger dispatch_discord_queue_after_insert
after insert on public.discord_notification_queue
for each row execute function public.dispatch_discord_queue();

do $$
declare t text;
begin
  foreach t in array array[
    'wishlists','community_suggestions','community_suggestion_votes','community_comments',
    'community_reviews','community_announcements','community_polls','community_poll_options'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

create index if not exists wishlists_card_id_idx on public.wishlists(card_id);
create index if not exists community_suggestions_created_idx on public.community_suggestions(created_at desc);
create index if not exists community_comments_suggestion_idx on public.community_comments(suggestion_id, created_at);
create index if not exists discord_notification_queue_status_idx on public.discord_notification_queue(status, created_at);
