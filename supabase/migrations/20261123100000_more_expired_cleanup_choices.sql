-- Expired Events can also stay 6 months or 1 year before they are deleted.
alter table public.profiles drop constraint profiles_expired_cleanup_days_check;
alter table public.profiles
  add constraint profiles_expired_cleanup_days_check check (expired_cleanup_days in (7, 30, 90, 180, 365));
