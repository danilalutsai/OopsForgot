-- Google signups: Google fills Name and Surname (and the photo, read from the account itself), but
-- only the person can say they are 16 or older. Until they do, the profile waits with no
-- confirmation, and the app asks before anything else. Names may be empty only while waiting.
alter table public.profiles
  alter column confirmed_16_plus_at drop not null,
  drop constraint profiles_name_check,
  drop constraint profiles_surname_check,
  add constraint profiles_name_check check (confirmed_16_plus_at is null or length(trim(name)) > 0),
  add constraint profiles_surname_check check (confirmed_16_plus_at is null or length(trim(surname)) > 0);

create or replace function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := new.raw_user_meta_data;
  zone text := nullif(meta ->> 'time_zone', '');
  money text := nullif(meta ->> 'currency', '');
  full_name text := trim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
  first_name text;
  last_name text;
begin
  if zone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = zone) then
    zone := 'UTC';
  end if;
  if money is null or money !~ '^[A-Z]{3}$' then
    money := 'EUR';
  end if;

  if coalesce((meta ->> 'confirmed_16_plus')::boolean, false) then
    insert into public.profiles (id, name, surname, confirmed_16_plus_at, time_zone, currency)
    values (new.id, trim(meta ->> 'name'), trim(meta ->> 'surname'), now(), zone, money);
  elsif coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'google' then
    -- Google's given and family name when sent; otherwise the first word of the full name, and the rest
    first_name := coalesce(nullif(trim(meta ->> 'given_name'), ''), split_part(full_name, ' ', 1));
    last_name := coalesce(nullif(trim(meta ->> 'family_name'), ''), trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)));
    insert into public.profiles (id, name, surname, confirmed_16_plus_at, time_zone, currency)
    values (new.id, first_name, last_name, null, zone, money);
  else
    raise exception 'People must confirm they are 16 or older';
  end if;
  return new;
end;
$$;

-- The Google person checks their names and confirms they are 16 or older.
create function public.finish_signup(name text, surname text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
     set name = trim(finish_signup.name),
         surname = trim(finish_signup.surname),
         confirmed_16_plus_at = coalesce(confirmed_16_plus_at, now())
   where id = (select auth.uid());
end;
$$;

revoke execute on function public.finish_signup(text, text) from public, anon;
grant execute on function public.finish_signup(text, text) to authenticated;
