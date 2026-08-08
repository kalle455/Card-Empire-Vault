-- Verified DMO Marketplace average-price state. Unknown values are never estimated.

begin;

alter table public.cards
  add column if not exists avg_price numeric(10,2) check (avg_price is null or avg_price > 0),
  add column if not exists price_status text not null default 'needs_review'
    check (price_status in ('available', 'unavailable', 'needs_review')),
  add column if not exists price_updated_at timestamptz,
  add column if not exists price_source text not null default 'DMO Marketplace';

create index if not exists cards_price_status_idx on public.cards (price_status);

-- Preserve prior manually entered comparison values, but never present them as verified averages.
update public.cards
set avg_price = nullif(external_market_price, 0),
    price_status = 'needs_review',
    price_updated_at = external_market_checked_at,
    price_source = 'DMO Marketplace'
where external_market_price is not null
  and avg_price is null;

-- Exact averages visibly reported by the source during the verified 2026-08-08 inspection.
update public.cards as card
set avg_price = source.avg_price,
    price_status = 'available',
    price_updated_at = now(),
    price_source = 'DMO Marketplace'
from (values
  ('Book of Life', 3357::numeric),
  ('Reinforcement of the Army', 4300::numeric),
  ('Toon World', 3550::numeric),
  ('Upstart Goblin', 2344::numeric)
) as source(name, avg_price)
where lower(card.name) = lower(source.name);

commit;
