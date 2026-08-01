-- Card Empire Cardstock price memory.
-- Every inserted card and every real price change receives an immutable history entry.

create table if not exists public.card_price_history (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  changed_at timestamptz not null default now()
);

create index if not exists card_price_history_card_time_idx
  on public.card_price_history (card_id, changed_at);

alter table public.card_price_history enable row level security;

revoke all on table public.card_price_history from anon, authenticated;
grant select on table public.card_price_history to authenticated;
grant all on table public.card_price_history to service_role;

drop policy if exists "Verified players see card price history" on public.card_price_history;
create policy "Verified players see card price history"
on public.card_price_history
for select
to authenticated
using (public.is_discord_user() or public.is_admin());

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.capture_card_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.card_price_history (card_id, price, changed_at)
    values (new.id, new.price, now());
  end if;
  return new;
end;
$$;

revoke execute on function private.capture_card_price() from public, anon, authenticated;

insert into public.card_price_history (card_id, price, changed_at)
select card.id, card.price, coalesce(card.created_at, now())
from public.cards as card
where not exists (
  select 1
  from public.card_price_history as history
  where history.card_id = card.id
);

drop trigger if exists capture_card_price_history on public.cards;
create trigger capture_card_price_history
after insert or update of price on public.cards
for each row execute function private.capture_card_price();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'card_price_history'
  ) then
    alter publication supabase_realtime add table public.card_price_history;
  end if;
end $$;
