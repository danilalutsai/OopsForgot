-- A sent Reminder is remembered by its exact moment, not just by Event, date and kind. Moving an
-- Event (another date or Start time) gives its Reminders new moments, so they go out again; going
-- back to a moment that already went out sends nothing twice; edits that don't move it (name, notes,
-- price, Category) keep the same moments and so never send again.
alter table public.sent_reminders add column send_at timestamptz;

-- Existing rows: the moment the Reminder was for, worked out from the Event as it is now, when the
-- row was sent for that moment (on time, or late by up to a day of catch-up). Before 20 Nov 2026,
-- day Reminders of an Event with a Start time went out at the day Reminder time instead; such a row
-- counts as sent for today's moment, so the rule change sends nothing twice. Anything else (the
-- Event moved since): the time it was sent, which no future moment can match.
with r as (
  select s.item_id, s.due_date, s.kind, s.sent_at, p.time_zone as tz, p.day_reminder_time as drt, i.due_time as dt,
    case s.kind
      when '30m' then interval '30 minutes' when '1h' then interval '1 hour'
      when '2h' then interval '2 hours' when '4h' then interval '4 hours' end as before_time,
    case s.kind
      when '1d' then interval '1 day' when '2d' then interval '2 days' when '1w' then interval '7 days'
      when '2w' then interval '14 days' when '1M' then interval '1 month' end as before_day
  from public.sent_reminders s
  join public.items i on i.id = s.item_id
  join public.profiles p on p.id = i.user_id
), m as (
  select item_id, due_date, kind, sent_at,
    case
      when before_time is not null and dt is not null then ((due_date + dt) at time zone tz) - before_time
      when before_day is not null then ((due_date - before_day)::date + coalesce(dt, drt)) at time zone tz
      when kind = 'expired' then ((due_date + 1) + drt) at time zone tz
      when kind = 'trial' then (due_date + drt) at time zone tz
    end as moment,
    case when before_day is not null and dt is not null
      then ((due_date - before_day)::date + drt) at time zone tz end as old_rule_moment
  from r
)
update public.sent_reminders s
set send_at = case
  when m.sent_at >= m.moment and m.sent_at < m.moment + interval '25 hours' then m.moment
  when m.sent_at >= m.old_rule_moment and m.sent_at < m.old_rule_moment + interval '25 hours' then m.moment
  else m.sent_at
end
from m
where s.item_id = m.item_id and s.due_date = m.due_date and s.kind = m.kind;

update public.sent_reminders set send_at = sent_at where send_at is null;

alter table public.sent_reminders alter column send_at set not null;
alter table public.sent_reminders drop constraint sent_reminders_pkey;
alter table public.sent_reminders add primary key (item_id, due_date, kind, send_at);

-- "Send a test notification": at most one a minute per device (set only by the server).
alter table public.push_devices add column last_test_at timestamptz;
