-- Run after schema.sql in the Supabase SQL Editor.
alter type public.app_role add value if not exists 'trusted_trader';

create type public.card_rarity as enum ('common', 'rare', 'gold', 'rainbow');
create type public.card_category as enum ('monster', 'spell', 'trap');

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  ygo_card_id bigint,
  image_url text,
  category public.card_category not null default 'monster',
  rarity public.card_rarity not null default 'common',
  price numeric(10,2) not null check (price >= 0),
  bundle_price numeric(10,2),
  quantity integer not null default 1 check (quantity >= 0),
  description text not null default '',
  is_new boolean not null default true,
  popularity integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  card_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  paid_gold numeric(10,2) not null check (paid_gold >= 0),
  created_at timestamptz not null default now()
);

alter table public.feedback add column if not exists rating smallint check (rating between 1 and 5);
alter table public.feedback add column if not exists approved boolean not null default false;

alter table public.cards enable row level security;
alter table public.purchases enable row level security;

create policy "Signed-in players see cards" on public.cards for select to authenticated using (true);
create policy "Admins manage cards" on public.cards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Players view own purchases" on public.purchases for select to authenticated using (player_id = auth.uid() or public.is_admin());
create policy "Admins create purchases" on public.purchases for insert to authenticated with check (public.is_admin());
create policy "Public approved feedback" on public.feedback for select to authenticated using (approved or player_id = auth.uid() or public.is_admin());
create policy "Admins moderate feedback" on public.feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete feedback" on public.feedback for delete to authenticated using (public.is_admin());

alter publication supabase_realtime add table public.cards, public.purchases;
