-- Things a person tracks. Each person sees and changes only their own Items.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null check (
    category in ('documents', 'cards', 'subscriptions', 'free_trials', 'vehicle', 'home', 'health', 'purchases', 'travel', 'other')
  ),
  due_date date not null,
  due_time time,
  price_cents integer check (price_cents between 1 and 99999999),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index items_user_due on public.items (user_id, due_date);

alter table public.items enable row level security;

create policy "people see their own Items" on public.items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "people add their own Items" on public.items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "people change their own Items" on public.items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "people delete their own Items" on public.items
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.items to authenticated;
