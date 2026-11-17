-- Devices a person allowed to get push Reminders on. One row per browser push subscription.
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  label text not null default '' check (length(label) <= 80),
  created_at timestamptz not null default now()
);

alter table public.push_devices enable row level security;

create policy "people see their own devices" on public.push_devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "people add their own devices" on public.push_devices
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "people remove their own devices" on public.push_devices
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.push_devices to authenticated;
