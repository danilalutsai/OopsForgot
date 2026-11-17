-- Money spent: entered by hand, or (next ticket) created from a priced Item on its Due date.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_cents integer not null check (amount_cents between 1 and 99999999),
  category text not null check (
    category in ('documents', 'cards', 'subscriptions', 'vehicle', 'home', 'health', 'purchases', 'travel', 'other')
  ),
  date date not null,
  description text not null default '' check (length(description) <= 200),
  -- set for Expenses created from an Item; kept (as history) when the Item goes
  item_id uuid references public.items (id) on delete set null,
  item_name text,
  created_at timestamptz not null default now()
);

create index expenses_user_date on public.expenses (user_id, date);

alter table public.expenses enable row level security;

create policy "people see their own Expenses" on public.expenses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "people add their own Expenses" on public.expenses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "people change their own Expenses" on public.expenses
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "people delete their own Expenses" on public.expenses
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.expenses to authenticated;
grant insert (amount_cents, category, date, description) on public.expenses to authenticated;
grant update (amount_cents, category, date, description) on public.expenses to authenticated;

-- No Expenses in the future: checked when written (a check constraint can't use today's date).
create function public.expense_not_in_future() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- a day of leeway for people east of UTC whose "today" is already tomorrow there
  if new.date > current_date + 1 then
    raise exception 'An Expense cannot be in the future';
  end if;
  return new;
end;
$$;

create trigger expense_not_in_future
  before insert or update of date on public.expenses
  for each row execute function public.expense_not_in_future();
