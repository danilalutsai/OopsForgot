-- Production exposes no table automatically, not even to the server role, so the Edge Functions
-- (Reminder sender, account clean-up, Delete account) were refused ("permission denied for
-- table profiles"). The server role bypasses row level security and is only ever used by the
-- server: it gets every table and sequence, now and in later migrations.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public grant usage, select on sequences to service_role;
