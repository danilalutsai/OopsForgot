-- IDs (only) of deleted accounts, so they can be deleted again after restoring a backup.
create table public.deleted_accounts (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);
alter table public.deleted_accounts enable row level security;
