-- Reminders 5 and 15 minutes before the Start time, as well.
alter table public.items drop constraint items_reminder_offsets_check;
alter table public.items add constraint items_reminder_offsets_check
  check (reminder_offsets <@ array['5m', '15m', '30m', '1h', '2h', '4h', '1d', '2d', '1w', '2w', '1M']::text[]);

-- The sender runs every 5 minutes instead of 15, so a Reminder 5 minutes before arrives on time.
-- Start times are picked in 5-minute steps, so Reminder moments fall on these runs.
select cron.unschedule('send-reminders');
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_sender_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'reminder_sender_url')
  $$
);
