-- Empire Loyalty: points, recurring Vault Passes and timed V.I.P rewards.
-- Run after 004_purchase_card.sql in the Supabase SQL Editor.

alter table public.profiles
  add column if not exists loyalty_points integer not null default 0,
  add column if not exists loyalty_purchases integer not null default 0,
  add column if not exists loyalty_free_card_credits integer not null default 0,
  add column if not exists vip_until timestamptz;

drop function if exists public.purchase_card(uuid, integer, numeric);

create or replace function public.purchase_card(
  p_card_id uuid,
  p_quantity integer,
  p_paid_gold numeric,
  p_redeem_loyalty boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  available_stock integer;
  purchased_card_name text;
  card_price numeric;
  v_role public.app_role;
  v_vip_until timestamptz;
  v_is_vip boolean;
  v_expected_gold numeric;
  v_points integer;
  v_purchases integer;
  v_free_credits integer;
  v_points_earned integer;
  v_new_points integer;
  v_new_purchases integer;
  v_new_free_credits integer;
  v_new_vip_until timestamptz;
  v_vault_passes_earned integer;
  v_became_regular boolean := false;
  v_vip_week_unlocked boolean := false;
  v_vip_month_unlocked boolean := false;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if p_quantity < 1 then
    raise exception 'Invalid quantity.';
  end if;

  select quantity, name, price
    into available_stock, purchased_card_name, card_price
    from public.cards
   where id = p_card_id
   for update;

  if available_stock is null then
    raise exception 'Card no longer exists.';
  end if;
  if available_stock < p_quantity then
    raise exception 'This card has just sold out.';
  end if;

  select role, vip_until, loyalty_points, loyalty_purchases, loyalty_free_card_credits
    into v_role, v_vip_until, v_points, v_purchases, v_free_credits
    from public.profiles
   where id = auth.uid()
   for update;

  v_is_vip := v_role = 'vip' or coalesce(v_vip_until > now(), false);

  if p_redeem_loyalty then
    if p_quantity <> 1 or card_price > 5000 then
      raise exception 'A Vault Pass can only be used on one card priced at 5,000 G or less.';
    end if;
    if v_free_credits < 1 then
      raise exception 'No Vault Pass is available.';
    end if;
    v_expected_gold := 0;
  else
    v_expected_gold := card_price * p_quantity * case when v_is_vip then 0.75 else 1 end;
  end if;

  if coalesce(p_paid_gold, -1) <> v_expected_gold then
    raise exception 'The purchase price changed. Refresh the Vault and try again.';
  end if;

  update public.cards
  set quantity = quantity - p_quantity
  where id = p_card_id;

  insert into public.purchases (player_id, card_id, card_name, quantity, paid_gold)
  values (auth.uid(), p_card_id, purchased_card_name, p_quantity, v_expected_gold);

  v_points_earned := case
    when v_expected_gold <= 0 then 0
    else greatest(1, floor(v_expected_gold / 1000)::integer)
  end;
  v_new_points := v_points + v_points_earned;
  v_new_purchases := v_purchases + p_quantity;
  v_vault_passes_earned := floor(v_new_purchases / 2) - floor(v_purchases / 2);
  v_new_free_credits := v_free_credits - case when p_redeem_loyalty then 1 else 0 end + v_vault_passes_earned;
  v_new_vip_until := v_vip_until;

  if v_role = 'customer' and v_points < 25 and v_new_points >= 25 then
    v_became_regular := true;
  end if;

  if v_points < 100 and v_new_points >= 100 then
    v_new_vip_until := greatest(coalesce(v_vip_until, now()), now()) + interval '7 days';
    v_vip_week_unlocked := true;
  end if;

  if v_points < 250 and v_new_points >= 250 then
    v_new_vip_until := greatest(coalesce(v_new_vip_until, now()), now()) + interval '30 days';
    v_vip_month_unlocked := true;
  end if;

  update public.profiles
  set loyalty_points = v_new_points,
      loyalty_purchases = v_new_purchases,
      loyalty_free_card_credits = v_new_free_credits,
      vip_until = v_new_vip_until,
      role = case when v_became_regular then 'regular_customer' else role end
  where id = auth.uid();

  insert into public.notifications (player_id, message)
  values (auth.uid(), 'Purchase recorded: +' || v_points_earned || ' Empire Points.');

  if v_vault_passes_earned > 0 then
    insert into public.notifications (player_id, message)
    values (auth.uid(), 'Vault Pass unlocked: buy 2 cards, your next card up to 5,000 G is free.');
  end if;

  if v_became_regular then
    insert into public.notifications (player_id, message)
    values (auth.uid(), 'Loyalty level unlocked: Regular Customer.');
  end if;

  if v_vip_week_unlocked then
    insert into public.notifications (player_id, message)
    values (auth.uid(), 'V.I.P unlocked for 7 days. Your 25% Card Vault discount is active.');
  end if;

  if v_vip_month_unlocked then
    insert into public.notifications (player_id, message)
    values (auth.uid(), 'Vault Legend reward: V.I.P extended by 30 days.');
  end if;
end;
$$;

grant execute on function public.purchase_card(uuid, integer, numeric, boolean) to authenticated;
