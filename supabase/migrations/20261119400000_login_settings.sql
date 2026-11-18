-- How a person logs in. Adding a password to a Google-only account gives it no "email" identity,
-- so whether an account has a password is read from the account itself.
create function public.has_password() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select encrypted_password <> '' from auth.users where id = (select auth.uid())), false);
$$;

revoke execute on function public.has_password() from public, anon;
grant execute on function public.has_password() to authenticated;

-- The same, for the account functions (Delete account, Change password), which run as the server.
create function public.account_has_password(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select encrypted_password <> '' from auth.users where id = p_user), false);
$$;

revoke execute on function public.account_has_password(uuid) from public, anon, authenticated;
grant execute on function public.account_has_password(uuid) to service_role;
