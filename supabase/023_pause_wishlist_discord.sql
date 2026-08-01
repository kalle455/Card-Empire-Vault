-- Pause direct Discord wishlist delivery while keeping Card Empire wishlists
-- and in-app availability notifications fully operational.

drop trigger if exists dispatch_discord_queue_after_insert
  on public.discord_notification_queue;

create or replace function public.create_wishlist_stock_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_target record;
  v_message text;
  v_event_type text;
begin
  if old.quantity = new.quantity then return new; end if;

  if old.quantity > 0 and new.quantity <= 0 then
    v_event_type := 'sold';
  elsif old.quantity <= 0 and new.quantity > 0 then
    v_event_type := 'available';
  else
    return new;
  end if;

  for v_target in
    select w.id, w.player_id, w.availability_notifications
    from public.wishlists w
    where w.card_id = new.id
  loop
    if v_event_type = 'sold' then
      v_message := 'Wishlist update - ' || new.name || ' has been sold. You will be notified here if it returns.';
    elsif v_target.availability_notifications > 0 then
      v_event_type := 'available_again';
      v_message := 'Wishlist restock - ' || new.name || ' is available again in Cardstock.';
    else
      v_event_type := 'available';
      v_message := 'Wishlist available - ' || new.name || ' is now available in Cardstock.';
    end if;

    insert into public.notifications (player_id, message)
    values (v_target.player_id, v_message);

    if v_event_type in ('available', 'available_again') then
      update public.wishlists
      set availability_notifications = availability_notifications + 1
      where id = v_target.id;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.create_wishlist_stock_notifications()
  from public, anon, authenticated;

update public.discord_notification_queue
set status = 'failed',
    last_error = 'Discord wishlist delivery is paused.'
where status in ('pending', 'processing', 'waiting_configuration');
