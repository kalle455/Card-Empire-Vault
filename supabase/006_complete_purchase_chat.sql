-- Run after 005_live_purchase_chat.sql.
-- Lets Kalenski™ complete a trade and close the private chat safely.

alter table public.purchase_chats
  add column if not exists status text not null default 'open'
  check (status in ('open', 'deal_completed'));

alter table public.purchase_chats
  add column if not exists deal_completed_at timestamptz,
  add column if not exists deal_completed_by uuid references public.profiles(id) on delete set null;

drop policy if exists "Participants send purchase chat messages" on public.purchase_chat_messages;
create policy "Participants send purchase chat messages" on public.purchase_chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_system = false
    and exists (
      select 1 from public.purchase_chats
      where id = chat_id
        and status = 'open'
        and (buyer_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.complete_purchase_chat(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Only Kalenski™ can complete a deal.';
  end if;

  select buyer_id, status into v_buyer_id, v_status
  from public.purchase_chats
  where id = p_chat_id
  for update;

  if v_buyer_id is null then
    raise exception 'Chat not found.';
  end if;
  if v_status = 'deal_completed' then
    return;
  end if;

  update public.purchase_chats
  set status = 'deal_completed',
      deal_completed_at = now(),
      deal_completed_by = auth.uid()
  where id = p_chat_id;

  insert into public.purchase_chat_messages (chat_id, sender_id, body, is_system)
  values (p_chat_id, null, 'Deal completed by Kalenski™. This trade chat is now closed.', true);

  insert into public.notifications (player_id, message)
  values (v_buyer_id, 'Your purchase deal was completed by Kalenski™.');
end;
$$;

grant execute on function public.complete_purchase_chat(uuid) to authenticated;
