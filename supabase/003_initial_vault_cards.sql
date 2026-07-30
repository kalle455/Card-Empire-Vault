-- Optional: run after 002_empire_catalog.sql to permanently add the first Card Empire cards.
insert into public.cards (name, ygo_card_id, image_url, category, rarity, price, quantity, description)
values
  ('Dark Magician', 46986414, 'https://images.ygoprodeck.com/images/cards/46986414.jpg', 'monster', 'rainbow', 50000, 1, 'A legendary spellcaster from the private Card Empire vault.'),
  ('Blue-Eyes White Dragon', 89631139, 'https://images.ygoprodeck.com/images/cards/89631139.jpg', 'monster', 'gold', 42000, 2, 'An iconic dragon in premium condition.'),
  ('Jinzo', 77585513, 'https://images.ygoprodeck.com/images/cards/77585513.jpg', 'monster', 'rainbow', 35000, 1, 'A rare machine monster selected by Kalenski™.'),
  ('Sangan', 26202165, 'https://images.ygoprodeck.com/images/cards/26202165.jpg', 'monster', 'rare', 9000, 3, 'A trusted classic for the Card Empire collection.')
on conflict (name) do nothing;
