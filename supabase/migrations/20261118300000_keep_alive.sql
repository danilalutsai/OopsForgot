-- A tiny call the daily keep-alive job makes, so the free project sees database activity and never pauses.
create function public.keep_alive() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;

grant execute on function public.keep_alive() to anon;
