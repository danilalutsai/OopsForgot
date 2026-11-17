-- The Reminders picked for an Item, as offsets before its Due date. Kept on the Item itself,
-- so they come back with it on Undo and repeat with it every cycle.
alter table public.items
  add column reminder_offsets text[] not null default '{1d}'
    check (reminder_offsets <@ array['30m', '1h', '2h', '4h', '1d', '2d', '1w', '2w', '1M']::text[]);
