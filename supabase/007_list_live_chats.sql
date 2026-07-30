-- Run after 006_complete_purchase_chat.sql.
-- Provides a secure, reliable chat list for both the buyer and Kalenski™.

create or replace function public.list_purchase_chats()
returns table (
  id uuid,
  buyer_id uuid,
  buyer_username text,
  card_summary text,
  status text,
  created_at timestamptz,
  deal_completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    chat.id,
    chat.buyer_id,
    buyer.username,
    chat.card_summary,
    chat.status,
    chat.created_at,
    chat.deal_completed_at
  from public.purchase_chats as chat
  join public.profiles as buyer on buyer.id = chat.buyer_id
  where chat.buyer_id = auth.uid() or public.is_admin()
  order by chat.created_at desc;
$$;

grant execute on function public.list_purchase_chats() to authenticated;
