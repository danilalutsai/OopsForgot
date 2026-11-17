-- Unused accounts: deleted after 12 months without use, after warnings 30 and 7 days before.
alter table public.profiles
  add column last_active_at timestamptz not null default now(),
  add column warned_30_at timestamptz,
  add column warned_7_at timestamptz;

-- Opening the app while logged in counts as use: the clock and any warnings start over.
create function public.touch_activity() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_active_at = now(), warned_30_at = null, warned_7_at = null
  where id = auth.uid();
$$;

revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

-- Once a day, run the clean-up. It lives next to the Reminder sender, so its address comes from the
-- same Vault secret ('reminder_sender_url' with the function name swapped).
select cron.schedule(
  'account-cleanup',
  '30 3 * * *',
  $$
  select net.http_post(
    url := replace((select decrypted_secret from vault.decrypted_secrets where name = 'reminder_sender_url'),
                   'send-reminders', 'account-cleanup'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  -- only when the address really names the sender, so the swap can never call the wrong function
  where exists (
    select 1 from vault.decrypted_secrets
    where name = 'reminder_sender_url' and decrypted_secret like '%/send-reminders%'
  )
  $$
);
