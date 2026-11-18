-- How a person logs in. Adding a password to a Google-only account gives it no "email" identity,
-- so whether an account has a password is read from the account itself.
create function public.has_password() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select encrypted_password <> '' from auth.users where id = (select auth.uid())), false);
$$;

revoke execute on function public.has_password() from public, anon;
grant execute on function public.has_password() to authenticated;

-- The same, for the Delete account function (which works for any person, as the server).
create function public.account_has_password(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select encrypted_password <> '' from auth.users where id = p_user), false);
$$;

revoke execute on function public.account_has_password(uuid) from public, anon, authenticated;
grant execute on function public.account_has_password(uuid) to service_role;

-- Google is disconnected only when a password remains to log in with, so nobody locks themselves out.
create function public.disconnect_google() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_password() then
    raise exception 'Add a password before disconnecting Google';
  end if;
  delete from auth.identities where user_id = (select auth.uid()) and provider = 'google';
end;
$$;

revoke execute on function public.disconnect_google() from public, anon;
grant execute on function public.disconnect_google() to authenticated;
