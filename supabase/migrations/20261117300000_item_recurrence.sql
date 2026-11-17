-- Repeating Items: every N days, weeks, months or years, counted from the first Due date.
alter table public.items
  add column recurrence_unit text check (recurrence_unit in ('day', 'week', 'month', 'year')),
  add column recurrence_every integer check (recurrence_every between 1 and 365),
  add constraint items_recurrence_complete check ((recurrence_unit is null) = (recurrence_every is null));
