-- Calendar feed: off by default. A long random token in the feed link is the only key to it.
alter table public.profiles add column calendar_token text unique;

-- Turn the feed on (a fresh link) or reset it (the old link stops working at once).
create function public.new_calendar_link() returns text
language plpgsql security definer set search_path = '' as $$
declare
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;
  update public.profiles set calendar_token = token where id = auth.uid();
  return token;
end;
$$;

create function public.turn_off_calendar_feed() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set calendar_token = null where id = auth.uid();
end;
$$;

revoke execute on function public.new_calendar_link() from public, anon;
revoke execute on function public.turn_off_calendar_feed() from public, anon;
grant execute on function public.new_calendar_link() to authenticated;
grant execute on function public.turn_off_calendar_feed() to authenticated;
