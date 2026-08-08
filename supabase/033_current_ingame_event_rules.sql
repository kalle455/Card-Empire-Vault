-- Events now use the current in-game banlist unless their description states an exception.

update public.events
set banlist_id = null
where banlist_id is not null;

