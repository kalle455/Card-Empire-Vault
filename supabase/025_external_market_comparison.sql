-- Optional comparison price from the public DMO Marketplace.
-- Card Empire prices remain independent; the timestamp makes staleness visible.

alter table public.cards
  add column if not exists external_market_price numeric(10,2)
    check (external_market_price is null or external_market_price >= 0),
  add column if not exists external_market_checked_at timestamptz,
  add column if not exists external_market_source text
    not null default 'https://dmo-market.onrender.com/';

update public.cards
set external_market_checked_at = now()
where external_market_checked_at is null;

update public.cards
set external_market_price = case name
  when 'Barrel Dragon' then 2000
  when 'Blowback Dragon' then 800
  when 'Dark Magician' then 25000
  when 'Dark Snake Syndrome' then 1000
  when 'Machine King' then 130
  when 'Pot of Greed' then 45000
  when 'Twin-Barrel Dragon' then 1150
  when 'Winged Kuriboh' then 100
  when 'X-Head Cannon' then 1500
  when 'Z-Metal Tank' then 300
  else external_market_price
end;
