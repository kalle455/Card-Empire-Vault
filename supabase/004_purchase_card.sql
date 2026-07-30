-- Run after the earlier Supabase SQL files.
-- Makes stock reduction and purchase recording safe even when multiple players buy at once.
create or replace function public.purchase_card(
  p_card_id uuid,
  p_quantity integer,
  p_paid_gold numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  available_stock integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if p_quantity < 1 then
    raise exception 'Invalid quantity.';
  end if;

  select quantity into available_stock
  from public.cards
  where id = p_card_id
  for update;

  if available_stock is null then
    raise exception 'Card no longer exists.';
  end if;
  if available_stock < p_quantity then
    raise exception 'This card has just sold out.';
  end if;

  update public.cards
  set quantity = quantity - p_quantity
  where id = p_card_id;

  insert into public.purchases (player_id, card_id, quantity, paid_gold)
  values (auth.uid(), p_card_id, p_quantity, p_paid_gold);
end;
$$;

grant execute on function public.purchase_card(uuid, integer, numeric) to authenticated;
