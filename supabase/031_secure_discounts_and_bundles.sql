-- Secure cart discounts, discount codes and 3+ card bundle proposals.

begin;

create table if not exists public.automatic_discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 90),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  min_total numeric not null default 0 check (min_total >= 0),
  min_card_count integer not null default 0 check (min_card_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(trim(code)) and char_length(code) between 3 and 32),
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 90),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  min_total numeric not null default 0 check (min_total >= 0),
  min_card_count integer not null default 0 check (min_card_count >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.bundle_offers (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  items jsonb not null,
  card_summary text not null,
  listed_total numeric not null check (listed_total >= 0),
  proposed_total numeric not null check (proposed_total >= 0),
  counter_total numeric check (counter_total is null or counter_total >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'countered', 'declined', 'completed', 'failed')),
  chat_id uuid references public.purchase_chats(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table public.purchases
  add column if not exists order_id uuid,
  add column if not exists discount_label text,
  add column if not exists discount_percent numeric(5,2) not null default 0;

create index if not exists bundle_offers_buyer_created_idx on public.bundle_offers (buyer_id, created_at desc);
create index if not exists bundle_offers_status_created_idx on public.bundle_offers (status, created_at desc);
create index if not exists discount_codes_code_idx on public.discount_codes (code);

alter table public.automatic_discounts enable row level security;
alter table public.discount_codes enable row level security;
alter table public.bundle_offers enable row level security;

drop policy if exists "Admins manage automatic discounts" on public.automatic_discounts;
create policy "Admins manage automatic discounts" on public.automatic_discounts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Players view active automatic discounts" on public.automatic_discounts;
create policy "Players view active automatic discounts" on public.automatic_discounts
for select to authenticated using (
  active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
);

drop policy if exists "Admins manage discount codes" on public.discount_codes;
create policy "Admins manage discount codes" on public.discount_codes
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Players view own bundle offers" on public.bundle_offers;
create policy "Players view own bundle offers" on public.bundle_offers
for select to authenticated using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage bundle offers" on public.bundle_offers;
create policy "Admins manage bundle offers" on public.bundle_offers
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.quote_cart(
  p_items jsonb,
  p_code text default null,
  p_redeem_card_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subtotal numeric := 0;
  v_count integer := 0;
  v_free_value numeric := 0;
  v_points integer := 0;
  v_free_credits integer := 0;
  v_role public.app_role;
  v_vip_until timestamptz;
  v_vip_percent numeric := 0;
  v_auto_percent numeric := 0;
  v_auto_name text;
  v_code_percent numeric := 0;
  v_code_name text;
  v_discount_percent numeric := 0;
  v_discount_label text := 'Standard price';
  v_total numeric;
  v_line record;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'Your cart is empty.'; end if;

  for v_line in
    select c.id, c.name, c.price, c.quantity as stock, sum(x.quantity)::integer as requested
    from jsonb_to_recordset(p_items) as x(card_id uuid, quantity integer)
    join public.cards c on c.id = x.card_id
    group by c.id, c.name, c.price, c.quantity
  loop
    if v_line.requested < 1 or v_line.requested > v_line.stock then raise exception 'Stock changed for %.', v_line.name; end if;
    v_subtotal := v_subtotal + v_line.price * v_line.requested;
    v_count := v_count + v_line.requested;
    if p_redeem_card_id = v_line.id then v_free_value := v_line.price; end if;
  end loop;

  if v_count < 1 then raise exception 'No valid cards were found.'; end if;

  select role, vip_until, loyalty_points, loyalty_free_card_credits
  into v_role, v_vip_until, v_points, v_free_credits
  from public.profiles where id = auth.uid();

  if v_role = 'vip' or coalesce(v_vip_until > now(), false) then v_vip_percent := 25; end if;

  if p_redeem_card_id is not null then
    if v_free_value <= 0 or v_free_value > 5000 then raise exception 'The Cardstock Pass is not valid for this card.'; end if;
    if v_free_credits < 1 then raise exception 'No Cardstock Pass is available.'; end if;
  end if;

  select percentage, name into v_auto_percent, v_auto_name
  from public.automatic_discounts
  where active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and min_total <= v_subtotal and min_card_count <= v_count
  order by percentage desc, created_at desc limit 1;

  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select percentage, code into v_code_percent, v_code_name
    from public.discount_codes
    where code = upper(trim(p_code)) and active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and min_total <= v_subtotal and min_card_count <= v_count
      and (max_uses is null or use_count < max_uses)
    limit 1;
    if v_code_name is null then raise exception 'This discount code is invalid or not active.'; end if;
  end if;

  v_discount_percent := greatest(coalesce(v_vip_percent, 0), coalesce(v_auto_percent, 0), coalesce(v_code_percent, 0));
  if v_code_percent = v_discount_percent and v_code_percent > 0 then v_discount_label := 'Code ' || v_code_name;
  elsif v_auto_percent = v_discount_percent and v_auto_percent > 0 then v_discount_label := v_auto_name;
  elsif v_vip_percent > 0 then v_discount_label := 'V.I.P price';
  end if;

  v_total := round(greatest(0, v_subtotal - v_free_value) * (100 - v_discount_percent) / 100, 2);
  return jsonb_build_object(
    'subtotal', v_subtotal, 'card_count', v_count, 'free_value', v_free_value,
    'discount_percent', v_discount_percent, 'discount_label', v_discount_label,
    'total', v_total, 'code', v_code_name
  );
end;
$$;

create or replace function public.purchase_cart(
  p_items jsonb,
  p_code text default null,
  p_redeem_card_id uuid default null,
  p_expected_total numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote jsonb;
  v_total numeric;
  v_subtotal numeric;
  v_discount_percent numeric;
  v_discount_label text;
  v_free_value numeric;
  v_order_id uuid := gen_random_uuid();
  v_chat_id uuid;
  v_summary text;
  v_role public.app_role;
  v_vip_until timestamptz;
  v_points integer;
  v_purchases integer;
  v_free_credits integer;
  v_points_earned integer;
  v_new_points integer;
  v_new_vip_until timestamptz;
  v_passes integer;
  v_line record;
  v_card_name text;
  v_card_price numeric;
  v_card_stock integer;
begin
  v_quote := public.quote_cart(p_items, p_code, p_redeem_card_id);
  v_total := (v_quote->>'total')::numeric;
  v_subtotal := (v_quote->>'subtotal')::numeric;
  v_discount_percent := (v_quote->>'discount_percent')::numeric;
  v_discount_label := v_quote->>'discount_label';
  v_free_value := (v_quote->>'free_value')::numeric;

  if p_expected_total is null or p_expected_total <> v_total then
    raise exception 'The cart price changed. Refresh the quote and try again.';
  end if;

  select role, vip_until, loyalty_points, loyalty_purchases, loyalty_free_card_credits
  into v_role, v_vip_until, v_points, v_purchases, v_free_credits
  from public.profiles where id = auth.uid() for update;

  for v_line in
    select x.card_id, sum(x.quantity)::integer as requested
    from jsonb_to_recordset(p_items) as x(card_id uuid, quantity integer)
    group by x.card_id
    order by x.card_id
  loop
    select name, price, quantity into v_card_name, v_card_price, v_card_stock
    from public.cards where id = v_line.card_id for update;
    if v_card_name is null then raise exception 'A card in your cart no longer exists.'; end if;
    if v_line.requested < 1 or v_line.requested > v_card_stock then raise exception 'Stock changed for %.', v_card_name; end if;

    update public.cards set quantity = quantity - v_line.requested where id = v_line.card_id;
    insert into public.purchases (player_id, card_id, card_name, quantity, paid_gold, order_id, discount_label, discount_percent)
    values (
      auth.uid(), v_line.card_id, v_card_name, v_line.requested,
      round(greatest(0, v_card_price * v_line.requested - case when p_redeem_card_id = v_line.card_id then v_card_price else 0 end) * (100 - v_discount_percent) / 100, 2),
      v_order_id, v_discount_label, v_discount_percent
    );
  end loop;

  select string_agg(c.name || case when x.quantity > 1 then ' ×' || x.quantity else '' end, ', ' order by c.name)
  into v_summary
  from jsonb_to_recordset(p_items) as x(card_id uuid, quantity integer)
  join public.cards c on c.id = x.card_id;

  if nullif(trim(coalesce(p_code, '')), '') is not null and (v_quote->>'code') is not null then
    update public.discount_codes set use_count = use_count + 1 where code = v_quote->>'code';
  end if;

  v_points_earned := floor(v_total / 1000)::integer * 2;
  v_new_points := v_points + v_points_earned;
  v_passes := floor(v_new_points / 20) - floor(v_points / 20);
  v_new_vip_until := v_vip_until;
  if v_points < 50 and v_new_points >= 50 then v_new_vip_until := greatest(coalesce(v_vip_until, now()), now()) + interval '7 days'; end if;
  if v_points < 100 and v_new_points >= 100 then v_new_vip_until := greatest(coalesce(v_new_vip_until, now()), now()) + interval '30 days'; end if;

  update public.profiles set
    loyalty_points = v_new_points,
    loyalty_purchases = v_purchases + (v_quote->>'card_count')::integer,
    loyalty_free_card_credits = v_free_credits - case when p_redeem_card_id is null then 0 else 1 end + v_passes,
    vip_until = v_new_vip_until
  where id = auth.uid();

  insert into public.purchase_chats (buyer_id, card_summary) values (auth.uid(), v_summary) returning id into v_chat_id;
  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (v_chat_id, null, 'Thank you for your order! I''ll be with you shortly and process everything as soon as possible. Thank you for choosing Card Empire!', true);
  insert into public.notifications (player_id, message)
  select id, 'New purchase chat: ' || v_summary from public.profiles where role = 'admin';
  insert into public.notifications (player_id, message)
  values (auth.uid(), 'Purchase recorded: +' || v_points_earned || ' Empire Points.');

  return v_quote || jsonb_build_object('chat_id', v_chat_id, 'order_id', v_order_id, 'card_summary', v_summary);
end;
$$;

create or replace function public.create_bundle_offer(p_items jsonb, p_proposed_total numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote jsonb;
  v_id uuid;
begin
  v_quote := public.quote_cart(p_items, null, null);
  if (v_quote->>'card_count')::integer < 3 then raise exception 'Bundle offers require at least three cards.'; end if;
  if p_proposed_total <= 0 then raise exception 'Enter a valid bundle total.'; end if;
  insert into public.bundle_offers (buyer_id, items, card_summary, listed_total, proposed_total)
  values (auth.uid(), p_items, '', (v_quote->>'total')::numeric, p_proposed_total)
  returning id into v_id;
  update public.bundle_offers b set card_summary = (
    select string_agg(c.name || case when x.quantity > 1 then ' ×' || x.quantity else '' end, ', ' order by c.name)
    from jsonb_to_recordset(b.items) as x(card_id uuid, quantity integer)
    join public.cards c on c.id = x.card_id
  ) where b.id = v_id;
  insert into public.notifications (player_id, message)
  select id, 'New bundle offer for ' || (v_quote->>'card_count') || ' cards.' from public.profiles where role = 'admin';
  return v_id;
end;
$$;

create or replace function public.respond_to_bundle_offer(p_offer_id uuid, p_status text, p_counter_total numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.bundle_offers%rowtype;
  v_chat_id uuid;
begin
  if not public.is_admin() then raise exception 'Only Kalenski can respond to bundle offers.'; end if;
  if p_status not in ('accepted', 'countered', 'declined') then raise exception 'Invalid bundle response.'; end if;
  select * into v_offer from public.bundle_offers where id = p_offer_id for update;
  if v_offer.id is null then raise exception 'Bundle offer not found.'; end if;
  if v_offer.status <> 'pending' then raise exception 'This bundle offer has already been answered.'; end if;
  if p_status = 'countered' and coalesce(p_counter_total, 0) <= 0 then raise exception 'Enter a valid counter total.'; end if;

  update public.bundle_offers set status = p_status, counter_total = case when p_status = 'countered' then p_counter_total else null end, responded_at = now()
  where id = p_offer_id;
  if p_status = 'declined' then
    insert into public.notifications (player_id, message) values (v_offer.buyer_id, 'Your bundle offer was declined.');
    return null;
  end if;

  insert into public.purchase_chats (buyer_id, card_summary)
  values (v_offer.buyer_id, 'BUNDLE · ' || v_offer.card_summary) returning id into v_chat_id;
  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (v_chat_id, null, case when p_status = 'accepted'
    then 'Kalenski accepted your bundle offer of ' || v_offer.proposed_total || ' G. Confirm the final handover here.'
    else 'Kalenski sent a bundle counteroffer of ' || p_counter_total || ' G. Continue the negotiation here.' end, true);
  update public.bundle_offers set chat_id = v_chat_id where id = p_offer_id;
  insert into public.notifications (player_id, message)
  values (v_offer.buyer_id, case when p_status = 'accepted' then 'Your bundle offer was accepted. Chat is ready.' else 'You received a bundle counteroffer. Chat is ready.' end);
  return v_chat_id;
end;
$$;

revoke all on function public.quote_cart(jsonb, text, uuid) from public, anon;
revoke all on function public.purchase_cart(jsonb, text, uuid, numeric) from public, anon;
revoke all on function public.create_bundle_offer(jsonb, numeric) from public, anon;
revoke all on function public.respond_to_bundle_offer(uuid, text, numeric) from public, anon;
grant execute on function public.quote_cart(jsonb, text, uuid) to authenticated;
grant execute on function public.purchase_cart(jsonb, text, uuid, numeric) to authenticated;
grant execute on function public.create_bundle_offer(jsonb, numeric) to authenticated;
grant execute on function public.respond_to_bundle_offer(uuid, text, numeric) to authenticated;

do $$ begin alter publication supabase_realtime add table public.bundle_offers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.automatic_discounts; exception when duplicate_object then null; end $$;

commit;
