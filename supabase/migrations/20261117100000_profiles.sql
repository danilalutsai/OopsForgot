-- One profile per person, created with their account from the signup details.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  surname text not null check (length(trim(surname)) > 0),
  confirmed_16_plus_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "people see their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "people change their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant update (name, surname) on public.profiles to authenticated;

-- Signup passes name, surname and the 16+ confirmation as user metadata.
-- Missing details stop the signup instead of creating an incomplete account.
create function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((new.raw_user_meta_data ->> 'confirmed_16_plus')::boolean, false) is not true then
    raise exception 'People must confirm they are 16 or older';
  end if;
  insert into public.profiles (id, name, surname, confirmed_16_plus_at)
  values (new.id, trim(new.raw_user_meta_data ->> 'name'), trim(new.raw_user_meta_data ->> 'surname'), now());
  return new;
end;
$$;

revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();
