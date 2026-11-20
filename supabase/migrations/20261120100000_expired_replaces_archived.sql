-- Expired replaces Archived. A one-time Item past its Due date is Expired and waits in the Expired
-- part of the list; there is no Archived state any more. No Item is deleted here.

-- "Keep in Expired" (and "No, I cancelled" for a free trial) answers the question for one Due date,
-- the same way handled_due_date does: a new Due date asks again.
alter table public.items add column kept_expired_due_date date;

-- Archived Items whose Due date has passed (or is today) stay out of the way: they are Expired, with
-- the question already answered, as archiving had answered it. Archived Items with a Due date still
-- ahead, and archived repeating Items, simply come back into the list: nothing to move for them.
update public.items i
set kept_expired_due_date = i.due_date
from public.profiles p
where p.id = i.user_id
  and i.archived_at is not null
  and i.recurrence_unit is null
  and i.due_date <= (now() at time zone p.time_zone)::date;

-- only now, with the data moved, the column goes
alter table public.items drop column archived_at;

-- How long an Expired Item stays before it is deleted: 7, 30 (the default) or 90 days; null = never.
alter table public.profiles
  add column expired_cleanup_days smallint default 30 check (expired_cleanup_days in (7, 30, 90));
grant update (expired_cleanup_days) on public.profiles to authenticated;

-- Deletes one-time Items Expired longer than their owner's setting. Expired starts the day after the
-- Due date (in the owner's time zone). Their Expenses stay: item_id goes to null.
create function public.delete_old_expired_items()
returns void
language sql security definer set search_path = '' as $$
  delete from public.items i
  using public.profiles p
  where p.id = i.user_id
    and p.expired_cleanup_days is not null
    and i.recurrence_unit is null
    and i.due_date < (now() at time zone p.time_zone)::date - p.expired_cleanup_days;
$$;
revoke execute on function public.delete_old_expired_items() from public, anon, authenticated;

select cron.schedule('expired-cleanup', '45 3 * * *', $$ select public.delete_old_expired_items() $$);
