-- Run after 010_king_of_1_banlist.sql.
-- Keeps the sales book intact when an admin removes a card from the active Vault.

alter table public.purchases
  add column if not exists card_name text;

update public.purchases as purchase
set card_name = card.name
from public.cards as card
where purchase.card_id = card.id
  and purchase.card_name is null;

alter table public.purchases
  alter column card_name set not null,
  alter column card_id drop not null;

alter table public.purchases
  drop constraint if exists purchases_card_id_fkey;

alter table public.purchases
  add constraint purchases_card_id_fkey
  foreign key (card_id) references public.cards(id) on delete set null;

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
  purchased_card_name text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if p_quantity < 1 then
    raise exception 'Invalid quantity.';
  end if;

  select quantity, name into available_stock, purchased_card_name
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

  insert into public.purchases (player_id, card_id, card_name, quantity, paid_gold)
  values (auth.uid(), p_card_id, purchased_card_name, p_quantity, p_paid_gold);
end;
$$;

grant execute on function public.purchase_card(uuid, integer, numeric) to authenticated;
