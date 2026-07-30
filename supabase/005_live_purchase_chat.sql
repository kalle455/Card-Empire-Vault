-- Run after 004_purchase_card.sql in the Supabase SQL Editor.
-- Creates a private, real-time purchase chat between a buyer and Kalenski™.

create table if not exists public.purchase_chats (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  card_summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.purchase_chats(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists purchase_chats_buyer_created_idx
  on public.purchase_chats (buyer_id, created_at desc);
create index if not exists purchase_chat_messages_chat_created_idx
  on public.purchase_chat_messages (chat_id, created_at);

alter table public.purchase_chats enable row level security;
alter table public.purchase_chat_messages enable row level security;

drop policy if exists "Participants read purchase chats" on public.purchase_chats;
create policy "Participants read purchase chats" on public.purchase_chats
  for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists "Participants read purchase chat messages" on public.purchase_chat_messages;
create policy "Participants read purchase chat messages" on public.purchase_chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.purchase_chats
      where id = chat_id and (buyer_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Participants send purchase chat messages" on public.purchase_chat_messages;
create policy "Participants send purchase chat messages" on public.purchase_chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_system = false
    and exists (
      select 1 from public.purchase_chats
      where id = chat_id and (buyer_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.start_purchase_chat(p_card_summary text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_buyer_name text;
  v_card_summary text := left(trim(coalesce(p_card_summary, '')), 800);
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if v_card_summary = '' then
    raise exception 'A card summary is required.';
  end if;

  insert into public.purchase_chats (buyer_id, card_summary)
  values (auth.uid(), v_card_summary)
  returning id into v_chat_id;

  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (
    v_chat_id,
    null,
    'Purchase request received for ' || v_card_summary || '. Kalenski™ will confirm the in-game trade with you here shortly.',
    true
  );

  select username into v_buyer_name from public.profiles where id = auth.uid();
  insert into public.notifications (player_id, message)
  select id, 'New purchase chat from ' || coalesce(v_buyer_name, 'a player') || ': ' || v_card_summary
  from public.profiles
  where role = 'admin';

  return v_chat_id;
end;
$$;

grant execute on function public.start_purchase_chat(text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.purchase_chats;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.purchase_chat_messages;
exception when duplicate_object then null;
end $$;
