-- An Item can say when it ends: the Finish time, later than the Start time (due_time) on the same day.
-- No Start time means all day, so there is no Finish time either.
alter table public.items
  add column finish_time time,
  add constraint items_finish_after_start
    check (finish_time is null or (due_time is not null and finish_time > due_time));
