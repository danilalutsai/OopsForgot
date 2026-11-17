-- Production was created with "Automatically expose new tables" off: a new table is
-- invisible to the Data API until a migration grants access on purpose.
-- Do the same locally so both behave alike. Every table migration must therefore
-- grant anon / authenticated exactly what they need and enable row level security.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
