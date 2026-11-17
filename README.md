# OopsProof

OopsProof: never miss an expiry, renewal or payment date. Track document expiries, card expiry dates, free trials, subscriptions and bills, get Reminders before they're due, follow them in your calendar, and see monthly spending by Category.

## Run it locally

Needs Node (see `.nvmrc`), pnpm and Docker Desktop (for local Supabase).

```sh
pnpm install
pnpm db:start            # local Supabase in Docker; prints the local keys
cp .env.example .env.local   # paste the local anon key
pnpm dev                 # web app at http://localhost:5173
```

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test                # unit tests (shared rules)
pnpm test:integration    # needs `pnpm db:start`
pnpm test:e2e            # Playwright + axe
```

## Layout

- `app/`: the Vue web app (PWA)
- `shared/`: the shared rules, used by the app and the Edge Functions; never reads the clock
- `supabase/`: migrations, Edge Functions, seed, integration tests
