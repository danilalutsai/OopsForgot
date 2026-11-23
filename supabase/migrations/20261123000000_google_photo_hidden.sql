-- A Google signup shows the Google photo until the person adds their own. Removing a photo (their own
-- or Google's) leaves the initials: the Google photo stays hidden from then on.
alter table public.profiles add column google_photo_hidden boolean not null default false;
grant update (google_photo_hidden) on public.profiles to authenticated;
