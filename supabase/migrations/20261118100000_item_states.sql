-- Handled: the Due date a person marked as dealt with. Archived: no longer tracked, history kept.
alter table public.items
  add column handled_due_date date,
  add column archived_at timestamptz;
