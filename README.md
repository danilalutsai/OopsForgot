# OopsProof

OopsProof: never miss an expiry, renewal or payment date. Track document expiries, card expiry dates, free trials, subscriptions and bills, get Reminders before they're due, follow them in your calendar, and see monthly spending by Category.

## Run it locally

Needs Node (see `.nvmrc`), pnpm and Docker Desktop (for local Supabase).

```sh
pnpm install
pnpm db:start                # local Supabase in Docker
cp .env.example .env.local   # local values only; nothing secret
pnpm dev                     # web app at http://localhost:5173
pnpm functions:serve         # Edge Functions, with a fake clock and fake push (another terminal)
```

Local emails (signup links, password resets) land in Mailpit at http://127.0.0.1:54324.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test                # unit tests (shared rules)
pnpm test:integration    # needs `pnpm db:start` and `pnpm functions:serve`
pnpm test:e2e            # Playwright + axe; same needs
```

## Production

Every push to `main` that passes the checks deploys (the `deploy` job in `.github/workflows/ci.yml`):

1. an encrypted backup first, in the private `oopsproof-backups` repo (restore steps: its `RESTORE.md`)
2. database migrations (`supabase db push`, over IPv4 through the pooler: `scripts/pooler-url.sh`)
3. Edge Functions
4. the web app to Cloudflare Pages: https://oopsproof.pages.dev
5. a live check of the app and the functions

Secret values live in the owner's password manager and in these places only, never in the repo:

- GitHub Actions secrets (OopsProof): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BACKUPS_DISPATCH_TOKEN`; variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VAPID_PUBLIC_KEY`
- GitHub Actions secrets (oopsproof-backups): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `BACKUP_AGE_PUBLIC_KEY`
- Supabase Edge Function secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Supabase Vault (read by the Reminder and clean-up cron jobs): `reminder_sender_url`, `service_role_key`

A daily keep-alive (`.github/workflows/keep-alive.yml`) stops the free Supabase project from pausing.

## Layout

- `app/`: the Vue web app (PWA)
- `shared/`: the shared rules, used by the app and the Edge Functions; never reads the clock
- `supabase/`: migrations, Edge Functions, seed, integration tests
- `scripts/`: deploy helpers (backup, pooler address)
