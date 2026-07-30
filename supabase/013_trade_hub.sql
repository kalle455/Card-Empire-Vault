-- Trade Hub: player card trade proposals and admin-negotiated live chats.
-- Run after 006_complete_purchase_chat.sql in the Supabase SQL Editor.

create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete restrict,
  offered_cards text not null check (char_length(trim(offered_cards)) between 2 and 1000),
  message text not null default '' check (char_length(message) <= 1200),
  status text not null default 'pending' check (status in ('pending', 'declined', 'accepted', 'negotiating')),
  chat_id uuid references public.purchase_chats(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists trade_offers_player_created_idx
  on public.trade_offers (player_id, created_at desc);
create index if not exists trade_offers_status_created_idx
  on public.trade_offers (status, created_at desc);

alter table public.trade_offers enable row level security;

drop policy if exists "Players view own trade offers" on public.trade_offers;
create policy "Players view own trade offers"
on public.trade_offers
for select
to authenticated
using (player_id = auth.uid() or public.is_admin());

drop policy if exists "Players create own trade offers" on public.trade_offers;
create policy "Players create own trade offers"
on public.trade_offers
for insert
to authenticated
with check (player_id = auth.uid() and status = 'pending');

drop policy if exists "Admins manage trade offers" on public.trade_offers;
create policy "Admins manage trade offers"
on public.trade_offers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.create_trade_offer(
  p_card_id uuid,
  p_offered_cards text,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer_id uuid;
  v_card_name text;
  v_player_name text;
  v_offered_cards text := left(trim(coalesce(p_offered_cards, '')), 1000);
  v_message text := left(trim(coalesce(p_message, '')), 1200);
begin
  if auth.uid() is null then
    raise exception 'Please sign in before creating a trade offer.';
  end if;

  if char_length(v_offered_cards) < 2 then
    raise exception 'Describe the cards or items you are offering.';
  end if;

  select name into v_card_name
  from public.cards
  where id = p_card_id and quantity > 0;

  if v_card_name is null then
    raise exception 'This card is no longer available for trade.';
  end if;

  insert into public.trade_offers (player_id, card_id, offered_cards, message)
  values (auth.uid(), p_card_id, v_offered_cards, v_message)
  returning id into v_offer_id;

  select username into v_player_name from public.profiles where id = auth.uid();
  insert into public.notifications (player_id, message)
  select id, 'New Trade Hub offer from ' || coalesce(v_player_name, 'a player') || ' for ' || v_card_name || '.'
  from public.profiles
  where role = 'admin';

  return v_offer_id;
end;
$$;

grant execute on function public.create_trade_offer(uuid, text, text) to authenticated;

create or replace function public.respond_to_trade_offer(
  p_offer_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_card_id uuid;
  v_card_name text;
  v_offered_cards text;
  v_current_status text;
  v_chat_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only Kalenski™ can respond to Trade Hub offers.';
  end if;

  if p_status not in ('declined', 'accepted', 'negotiating') then
    raise exception 'Invalid trade response.';
  end if;

  select player_id, card_id, offered_cards, status
    into v_player_id, v_card_id, v_offered_cards, v_current_status
    from public.trade_offers
   where id = p_offer_id
   for update;

  if v_player_id is null then
    raise exception 'Trade offer not found.';
  end if;

  if v_current_status <> 'pending' then
    raise exception 'This trade offer has already been answered.';
  end if;

  select name into v_card_name from public.cards where id = v_card_id;
  v_card_name := coalesce(v_card_name, 'the requested card');

  update public.trade_offers
  set status = p_status,
      responded_at = now()
  where id = p_offer_id;

  if p_status = 'declined' then
    insert into public.notifications (player_id, message)
    values (v_player_id, 'Your Trade Hub offer for ' || v_card_name || ' was declined by Kalenski™.');
    return null;
  end if;

  insert into public.purchase_chats (buyer_id, card_summary)
  values (
    v_player_id,
    'TRADE HUB · Wants: ' || v_card_name || ' · Offers: ' || v_offered_cards
  )
  returning id into v_chat_id;

  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (
    v_chat_id,
    null,
    case when p_status = 'accepted'
      then 'Kalenski™ accepted your Trade Hub offer. Confirm the final trade details here.'
      else 'Kalenski™ wants to negotiate your Trade Hub offer. Continue the trade conversation here.'
    end,
    true
  );

  update public.trade_offers
  set chat_id = v_chat_id
  where id = p_offer_id;

  insert into public.notifications (player_id, message)
  values (
    v_player_id,
    case when p_status = 'accepted'
      then 'Your Trade Hub offer for ' || v_card_name || ' was accepted. Your private chat is ready.'
      else 'Kalenski™ wants to negotiate your Trade Hub offer for ' || v_card_name || '. Your private chat is ready.'
    end
  );

  return v_chat_id;
end;
$$;

grant execute on function public.respond_to_trade_offer(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.trade_offers;
exception when duplicate_object then null;
end $$;