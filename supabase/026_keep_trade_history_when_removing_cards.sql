-- Preserve Trade Order history when an inventory card is removed.
alter table public.trade_offers
  add column if not exists card_name_snapshot text;

update public.trade_offers trade
set card_name_snapshot = cards.name
from public.cards cards
where trade.card_id = cards.id
  and trade.card_name_snapshot is null;

create or replace function private.capture_trade_card_name()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.card_id is not null then
    select name into new.card_name_snapshot
    from public.cards
    where id = new.card_id;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_trade_card_name on public.trade_offers;
create trigger capture_trade_card_name
before insert or update of card_id on public.trade_offers
for each row execute function private.capture_trade_card_name();

alter table public.trade_offers
  alter column card_id drop not null;

alter table public.trade_offers
  drop constraint if exists trade_offers_card_id_fkey;

alter table public.trade_offers
  add constraint trade_offers_card_id_fkey
  foreign key (card_id) references public.cards(id) on delete set null;
