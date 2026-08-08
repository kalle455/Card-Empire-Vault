-- Adds an explicit failed outcome to private purchase/trade chats.
-- The database remains the source of truth; only an administrator can seal an outcome.

begin;

alter table public.purchase_chats
  drop constraint if exists purchase_chats_status_check;

alter table public.purchase_chats
  add constraint purchase_chats_status_check
  check (status in ('open', 'deal_completed', 'deal_failed'));

alter table public.purchase_chats
  add column if not exists deal_failed_at timestamptz,
  add column if not exists deal_failed_by uuid references public.profiles(id) on delete set null;

alter table public.trade_offers
  drop constraint if exists trade_offers_status_check;

alter table public.trade_offers
  add constraint trade_offers_status_check
  check (status in ('pending', 'declined', 'accepted', 'negotiating', 'completed', 'failed'));

create or replace function public.complete_purchase_chat(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Only Kalenski can complete a deal.';
  end if;

  select buyer_id, status into v_buyer_id, v_status
  from public.purchase_chats
  where id = p_chat_id
  for update;

  if v_buyer_id is null then raise exception 'Chat not found.'; end if;
  if v_status = 'deal_completed' then return; end if;
  if v_status = 'deal_failed' then raise exception 'A failed deal cannot be completed.'; end if;

  update public.purchase_chats
  set status = 'deal_completed', deal_completed_at = now(), deal_completed_by = auth.uid()
  where id = p_chat_id;

  update public.trade_offers set status = 'completed', responded_at = now()
  where chat_id = p_chat_id;

  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (p_chat_id, null, 'Deal completed by Kalenski. This trade chat is now closed.', true);

  insert into public.notifications (player_id, message)
  values (v_buyer_id, 'Your deal was completed by Kalenski.');
end;
$$;

create or replace function public.fail_purchase_chat(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Only Kalenski can mark a deal as failed.';
  end if;

  select buyer_id, status into v_buyer_id, v_status
  from public.purchase_chats
  where id = p_chat_id
  for update;

  if v_buyer_id is null then raise exception 'Chat not found.'; end if;
  if v_status = 'deal_failed' then return; end if;
  if v_status = 'deal_completed' then raise exception 'A completed deal cannot be changed.'; end if;

  update public.purchase_chats
  set status = 'deal_failed', deal_failed_at = now(), deal_failed_by = auth.uid()
  where id = p_chat_id;

  update public.trade_offers set status = 'failed', responded_at = now()
  where chat_id = p_chat_id;

  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (p_chat_id, null, 'Deal marked as failed by Kalenski. This conversation is now closed.', true);

  insert into public.notifications (player_id, message)
  values (v_buyer_id, 'Your deal was marked as failed by Kalenski.');
end;
$$;

revoke all on function public.complete_purchase_chat(uuid) from public, anon;
grant execute on function public.complete_purchase_chat(uuid) to authenticated;
revoke all on function public.fail_purchase_chat(uuid) from public, anon;
grant execute on function public.fail_purchase_chat(uuid) to authenticated;

commit;
