-- Security baseline for the exposed Data API.
-- This migration is data-preserving: it changes privileges and policies only.
begin;

-- Public functions inherit EXECUTE for PUBLIC unless it is revoked explicitly.
-- Keep browser-callable functions restricted to signed-in users and let each
-- privileged function perform its existing ownership/admin check as well.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.is_discord_user() from public, anon;
grant execute on function public.is_discord_user() to authenticated;

revoke execute on function public.purchase_card(uuid, integer, numeric, boolean) from public, anon;
grant execute on function public.purchase_card(uuid, integer, numeric, boolean) to authenticated;

revoke execute on function public.start_purchase_chat(text) from public, anon;
grant execute on function public.start_purchase_chat(text) to authenticated;

revoke execute on function public.list_purchase_chats() from public, anon;
grant execute on function public.list_purchase_chats() to authenticated;

revoke execute on function public.complete_purchase_chat(uuid) from public, anon;
grant execute on function public.complete_purchase_chat(uuid) to authenticated;

revoke execute on function public.register_for_event(uuid) from public, anon;
grant execute on function public.register_for_event(uuid) to authenticated;

revoke execute on function public.set_event_winner(uuid, uuid) from public, anon;
grant execute on function public.set_event_winner(uuid, uuid) to authenticated;

revoke execute on function public.delete_player_profile(uuid) from public, anon;
grant execute on function public.delete_player_profile(uuid) to authenticated;

revoke execute on function public.respond_to_trade_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_trade_offer(uuid, text) to authenticated;

-- Trade Hub is a private preview. Remove every player entry point at the
-- database boundary; the existing admin policy remains the only table access.
revoke execute on function public.create_trade_offer(uuid, text, text) from public, anon, authenticated;
drop policy if exists "Players create own trade offers" on public.trade_offers;
drop policy if exists "Players view own trade offers" on public.trade_offers;

-- Trigger functions are never intended to be callable over /rest/v1/rpc.
revoke execute on function public.notify_event_change() from public, anon, authenticated;
revoke execute on function public.notify_event_registration() from public, anon, authenticated;
revoke execute on function public.notify_offer_change() from public, anon, authenticated;

-- Immutable helper: fix the database-advisor mutable search_path warning.
alter function public.event_capacity(text) set search_path = '';

commit;
