-- The game economy is progress too: stars, wardrobe, chest, streak freezes.
-- Adds the columns pushPlayer mirrors and pullProfileData reads (both are
-- defensive, so this migration can land any time).
alter table public.player_stats
  add column if not exists stars integer not null default 0,
  add column if not exists owned_cosmetics jsonb not null default '[]',
  add column if not exists equipped_bg text,
  add column if not exists equipped_accessory text,
  add column if not exists equipped_effect text,
  add column if not exists last_chest_day text,
  add column if not exists streak_freezes integer not null default 0,
  add column if not exists freeze_used_day text;
