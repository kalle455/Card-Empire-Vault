-- Run after 007_list_live_chats.sql.
-- Ensures every customer-facing live table is broadcast by Supabase Realtime.

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

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

do $$
begin
  alter publication supabase_realtime add table public.cards;
exception when duplicate_object then null;
end $$;
