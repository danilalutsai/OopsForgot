-- What the Reminder sender has sent. Claiming a row before sending makes every Reminder go out
-- once, even if two runs overlap. Only the sender (service role) touches these tables.
create table public.sent_reminders (
  item_id uuid not null references public.items (id) on delete cascade,
  due_date date not null,
  -- an offset like '1d', or 'expired' / 'trial'
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, due_date, kind)
);
alter table public.sent_reminders enable row level security;

-- When the sender last finished a run; the next run covers everything since then, so a failed
-- run's Reminders still go out (late) as long as their Due date isn't over.
create table public.reminder_runs (
  id smallint primary key default 1 check (id = 1),
  last_run_at timestamptz not null
);
alter table public.reminder_runs enable row level security;

-- Every 15 minutes, call the sender. Its address and the service key come from Vault
-- ('reminder_sender_url', 'service_role_key'), set once per project by the owner.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
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
