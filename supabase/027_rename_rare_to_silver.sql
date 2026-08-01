-- Rare is now called Silver throughout Card Empire.
-- Renaming the enum value updates every existing card atomically.
alter type public.card_rarity rename value 'rare' to 'silver';
