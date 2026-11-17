-- Automatic Expenses: the scheduled run creates one on each Due date of a priced Item.
-- expenses_through is the last date already handled, so a deleted automatic Expense never comes back.
alter table public.items add column expenses_through date;

-- one automatic Expense per Item and date, even if two runs overlap (manual ones have no Item)
alter table public.expenses add constraint expenses_item_date unique (item_id, date);

-- an automatic Expense keeps its Item's Category
create function public.expense_category_locked() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.item_id is not null and new.category is distinct from old.category then
    raise exception 'An automatic Expense keeps its Item''s Category';
  end if;
  return new;
end;
$$;

create trigger expense_category_locked
  before update of category on public.expenses
  for each row execute function public.expense_category_locked();

-- "Did you keep it?" — Yes: the trial becomes a monthly Subscription due a month later, and its
-- first charge (the trial's Due date) is recorded at once. One step, so it can't half-happen.
create function public.keep_trial(p_item_id uuid, p_name text, p_reminders text[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  trial public.items;
begin
  select * into trial from public.items
  where id = p_item_id and user_id = auth.uid() and category = 'free_trials' and recurrence_unit is null
  for update;
  if not found then
    raise exception 'No such free trial';
  end if;
  -- only once the trial has ended: its first charge can't be in the future
  if trial.due_date > current_date + 1 then
    raise exception 'The free trial has not ended yet';
  end if;

  update public.items set
    name = p_name,
    category = 'subscriptions',
    recurrence_unit = 'month',
    recurrence_every = 1,
    due_date = (trial.due_date + interval '1 month')::date,
    reminder_offsets = p_reminders,
    expenses_through = trial.due_date
  where id = trial.id;

  if trial.price_cents is not null then
    insert into public.expenses (user_id, amount_cents, category, date, item_id, item_name)
    values (trial.user_id, trial.price_cents, 'subscriptions', trial.due_date, trial.id, p_name)
    on conflict (item_id, date) do nothing;
  end if;
end;
$$;

revoke execute on function public.keep_trial(uuid, text, text[]) from public, anon;
grant execute on function public.keep_trial(uuid, text, text[]) to authenticated;

-- No future Expenses, ever, when people write them. Only the system's own inserts of automatic
-- Expenses (dated on Due dates up to today) skip the check, so test clocks and time zones can't trip it.
create or replace function public.expense_not_in_future() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.item_id is not null then
    return new;
  end if;
  if new.date > current_date + 1 then
    raise exception 'An Expense cannot be in the future';
  end if;
  return new;
end;
$$;
