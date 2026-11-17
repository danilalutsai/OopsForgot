-- A browser has one push subscription. Whoever turns push on in it takes it over: any earlier
-- person's row for the same subscription is removed, so their Reminders stop reaching this browser.
create function public.claim_push_device(p_endpoint text, p_p256dh text, p_auth text, p_label text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;
  delete from public.push_devices where endpoint = p_endpoint;
  insert into public.push_devices (user_id, endpoint, p256dh, auth, label)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_label, 80));
end;
$$;

revoke execute on function public.claim_push_device(text, text, text, text) from public, anon;
grant execute on function public.claim_push_device(text, text, text, text) to authenticated;
