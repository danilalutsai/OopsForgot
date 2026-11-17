-- Settings kept on the profile: time zone, currency, day Reminder time and photo.
alter table public.profiles
  add column time_zone text not null default 'UTC',
  add column currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  add column day_reminder_time time not null default '12:00'
    check (extract(minute from day_reminder_time)::int % 15 = 0 and extract(second from day_reminder_time) = 0),
  add column photo_path text;

-- A time zone must be one Postgres knows, so Reminder times can always be worked out.
create function public.check_profile_time_zone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown time zone %', new.time_zone;
  end if;
  return new;
end;
$$;

create trigger check_profile_time_zone
  before insert or update of time_zone on public.profiles
  for each row execute function public.check_profile_time_zone();

grant update (time_zone, currency, day_reminder_time, photo_path) on public.profiles to authenticated;

-- Signup also passes the browser's time zone and a currency guess.
create or replace function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((new.raw_user_meta_data ->> 'confirmed_16_plus')::boolean, false) is not true then
    raise exception 'People must confirm they are 16 or older';
  end if;
  insert into public.profiles (id, name, surname, confirmed_16_plus_at, time_zone, currency)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'name'),
    trim(new.raw_user_meta_data ->> 'surname'),
    now(),
    coalesce(nullif(new.raw_user_meta_data ->> 'time_zone', ''), 'UTC'),
    coalesce(nullif(new.raw_user_meta_data ->> 'currency', ''), 'EUR')
  );
  return new;
end;
$$;

-- Profile photos: private, one folder per person, small square images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg', 'image/webp']);

create policy "people see their own photo" on storage.objects
  for select to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "people add their own photo" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "people replace their own photo" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "people remove their own photo" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
