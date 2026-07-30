-- Run after 009_banlist_categories.sql.
-- Creates (or refreshes) Kalenski™'s official KING OF 1 banlist.
-- Duplicate entries from the original list have been removed.

do $$
declare
  v_admin_id uuid;
begin
  select id into v_admin_id
  from public.profiles
  where lower(username) = 'kalenski'
  order by created_at asc
  limit 1;

  if v_admin_id is null then
    select id into v_admin_id
    from public.profiles
    where role = 'admin'
    order by created_at asc
    limit 1;
  end if;

  if v_admin_id is null then
    raise exception 'Create the Kalenski admin profile before running this file.';
  end if;

  insert into public.banlists (name, card_names, banned_cards, limited_cards, created_by)
  values (
    'KING OF 1',
    array[
      'Dark Magician of Chaos',
      'Witch of the Black Forest',
      'Woodland Sprite',
      'Blue-Eyes Ultimate Dragon',
      'Sasuke Samurai #4',
      'Snipe Hunter',
      'Tribe-Infecting Virus',
      'Pot of Greed',
      'Graceful Charity',
      'Monster Reborn',
      'Change of Heart',
      'Dark Hole',
      'Raigeki',
      'Heavy Storm',
      'Harpie''s Feather Duster',
      'Painful Choice',
      'Final Countdown',
      'Serial Spell',
      'Mirror Force',
      'Torrential Tribute',
      'Rivalry of Warlords',
      'Jinzo',
      'Caius the Shadow Monarch',
      'Raiza the Storm Monarch',
      'Mobius the Frost Monarch',
      'Horus the Black Flame Dragon LV8',
      'Sacred Phoenix of Nephthys',
      'Thestalos the Firestorm Monarch',
      'Zaborg the Thunder Monarch',
      'Granmarg the Rock Monarch'
    ],
    array[
      'Dark Magician of Chaos',
      'Witch of the Black Forest',
      'Woodland Sprite',
      'Blue-Eyes Ultimate Dragon',
      'Sasuke Samurai #4',
      'Snipe Hunter',
      'Tribe-Infecting Virus',
      'Pot of Greed',
      'Graceful Charity',
      'Monster Reborn',
      'Change of Heart',
      'Dark Hole',
      'Raigeki',
      'Heavy Storm',
      'Harpie''s Feather Duster',
      'Painful Choice',
      'Final Countdown',
      'Serial Spell',
      'Mirror Force',
      'Torrential Tribute',
      'Rivalry of Warlords'
    ],
    array[
      'Jinzo',
      'Caius the Shadow Monarch',
      'Raiza the Storm Monarch',
      'Mobius the Frost Monarch',
      'Horus the Black Flame Dragon LV8',
      'Sacred Phoenix of Nephthys',
      'Thestalos the Firestorm Monarch',
      'Zaborg the Thunder Monarch',
      'Granmarg the Rock Monarch'
    ],
    v_admin_id
  )
  on conflict (name) do update
  set card_names = excluded.card_names,
      banned_cards = excluded.banned_cards,
      limited_cards = excluded.limited_cards;
end;
$$;
