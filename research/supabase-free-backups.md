# How can a Supabase Free database be backed up for free?

Research for issue #15. All facts were checked on **2026-11-16** against the official docs linked below. Free tiers and docs change often, so check them again before building.

## Short answer

**Supabase Free makes no backups for us, so we have to make our own.** Supabase itself says Free projects should "regularly export their data" with the Supabase command-line tool (`supabase db dump`) and keep the copies somewhere else.

The simplest setup that costs nothing and needs no credit card:

1. A **separate, private GitHub repository** (for example `OopsProof-backups`) holds one scheduled GitHub Actions job.
2. Once a day the job copies the database with `supabase db dump` (three files: roles, table structure, data).
3. It packs the files and **encrypts them with `age`** using only a *public* key. The matching secret key stays offline with the owner, so neither GitHub nor anyone who gets the file can read it.
4. It uploads the encrypted file as a **workflow artifact** that GitHub **deletes automatically after 30 days** (`retention-days: 30`).

With that setup, **a deleted account is gone from all backups within about 30 days** (the oldest copy that still has it expires then). That is the sentence the privacy notice needs.

If the copies must stay inside the EU, use **Cloudflare R2** with the `eu` jurisdiction instead of GitHub artifacts. It is free up to 10 GB, but Cloudflare asks for a payment card before R2 can be turned on.

## Why we need this

- Supabase backs up **only Pro, Team and Enterprise** projects every day. Free projects are not listed, and point-in-time recovery is a paid add-on only. [Supabase backups]
- Supabase's own advice: "We recommend that free tier plan projects regularly export their data" with `supabase db dump`, and keep backups off-site. [Supabase backups]
- A paused Free project can be restored in one click for **1 year**. The backup file can be downloaded only *after* that window ends, so it is not a working backup for us. [Supabase pausing]

## How to make the copy

### Supabase CLI `db dump` (recommended)

- `supabase db dump` is a wrapper around Postgres's `pg_dump`. It runs `pg_dump` inside a Docker container and leaves out schemas that Supabase manages itself. [CLI db dump]
- By default it dumps **only the table structure** (no rows). You need separate runs: `--role-only` (database roles), plain (structure), `--data-only --use-copy` (rows). [CLI db dump]
- Supabase's backup guide uses exactly these three files: `roles.sql`, `schema.sql`, `data.sql`, and excludes `storage.buckets_vectors` and `storage.vector_indexes` from the data dump. [Supabase backup & restore]
- Point it at the project with `--remote` (or `--db-url`, which still works but is deprecated and will be removed in CLI v4). [CLI db dump]
- **The data file contains `auth.users` rows in plain text, including email addresses and password hashes.** Supabase warns about this. [Supabase GitHub Actions backups] This is why the file must be encrypted before it leaves the job.
- Docker is needed. GitHub's Ubuntu runners have it; on your own laptop you need Docker Desktop. [Supabase backup & restore]

### Plain `pg_dump` (alternative)

- `pg_dump` makes a consistent copy even while the app is in use, and does not block users. [pg_dump]
- **Catch:** `pg_dump` refuses to dump a server with a *newer* major Postgres version than itself. The `pg_dump` on the runner must be the same major version as the Supabase database or newer. [pg_dump] The Supabase CLI avoids this problem because it brings its own container.

### Which connection string

- GitHub-hosted runners support only IPv4. Supabase's direct connection address uses IPv6 unless you pay for the IPv4 add-on, so use the **Session pooler** connection string and keep it in a GitHub secret (Supabase's example calls it `SUPABASE_DB_URL`). [Supabase GitHub Actions backups]

### What the copy does not include

- **Uploaded files** (Supabase Storage objects) are not in the database dump; only their metadata is. [Supabase backups] OopsProof's MVP has no file uploads, so this does not matter yet.
- If we ever use Supabase Vault / pgsodium, the encryption root key is **not** in the dump and must be saved separately. [Supabase backup & restore]
- Custom triggers or security rules (RLS) added to the `auth` or `storage` schemas are not in the dump; keep them in our own migration files. [Supabase backup & restore]

## Where to keep the copies for free

| | GitHub Actions artifacts (private repo) | Cloudflare R2 (`eu` jurisdiction) | Commit dumps to a Git repo (Supabase's example) |
|---|---|---|---|
| Cost | Free plan: $12/month of runner time for private repos (about 2,000 Linux minutes) and **500 MB** of artifact storage. A daily dump takes a minute or two. | **10 GB-month**, 1M writes, 10M reads per month free; no download fees. | Free |
| Card needed? | No. Without a card, GitHub simply blocks runs after the free amount is used up. | **Yes.** R2 needs a subscription with a payment method on file, even to use the free amount. | No |
| Stays in the EU? | Not chosen by us. A Free GitHub account cannot pick a storage region. | **Yes, guaranteed**, if the bucket is created with the `eu` jurisdiction. Location hints like `weur` are only "best effort". Jurisdiction cannot be changed later. | No |
| Automatic deletion | `retention-days`: 1 to **400 days** in private repos (1 to 90 in public). Default 90. Can also be deleted by hand; deletion is permanent. | Lifecycle rule "expire after N days". Objects are typically removed **within 24 hours** after they expire. | **None.** Old copies stay in Git history for ever, even after you delete the file. |
| Verdict | **Best free, no-card option.** | Best if EU-only storage is required and a card on file is acceptable. | **Avoid.** Makes deleting an account from backups practically impossible. |

Sources: [GitHub Actions billing], [GitHub artifact retention], [GitHub remove artifacts], [R2 pricing], [R2 data location], [R2 lifecycles], [R2 get started], [Supabase GitHub Actions backups].

**Not checked fully:** Backblaze B2 also offers "first 10 GB always free" with no minimum storage time, but its pricing page does not say whether a card is needed or which EU regions exist. [Backblaze pricing]

### Why a separate private repo, not the OopsProof repo

- **The OopsProof repo is public** (checked 2026-11-16). Anyone with read access can download workflow artifacts [GitHub download artifacts], and in a public repo that is everyone. Encryption would still protect the file, but there is no reason to publish it.
- In a public repo, **scheduled jobs switch off after 60 days without repo activity**. That rule is only for public repos. [GitHub schedule event]
- Public repos allow at most 90 days of artifact retention; private ones allow up to 400. [GitHub artifact retention]
- Scheduled runs can start late when GitHub is busy, especially at the top of the hour; pick an odd minute such as `17 3 * * *`. Schedules run only on the default branch. [GitHub schedule event]

## How to encrypt

- Use **`age`** (BSD-3 licence, `apt install age` on Ubuntu 22.04+). Encrypt with `age -r age1…` using the **public** key only; decrypting needs the secret key file (`-i`). [age]
- So the GitHub job only ever holds the public key. The secret key lives offline with the owner (for example in a password manager). Leaking the GitHub secret or the backup file then reveals nothing.
- GPG would also work, but `age` has no settings to get wrong.
- Keep the secret key safe: **if it is lost, every backup is useless.**

## How long to keep copies, and how fast deleted accounts drop out

- GDPR says a person's data must be erased "without undue delay" (Art. 17(1)), and a request must be answered within one month (Art. 12(3)). [GDPR]
- The EU data protection authorities (EDPB, report of 18 Feb 2026) found that many companies struggle with **backups** and with picking retention times, and that many quietly left backups out of erasure without a reason. They have not yet published exact rules for backups. [EDPB 2026]
- The usual, defensible practice: **do not edit old backups; let them expire on a fixed schedule, and say so in the privacy notice.** If a backup is ever restored, re-delete the accounts that were deleted since that backup was made.
- To make that last step possible, keep a short list of the **user IDs** (not names or emails) of deleted accounts for as long as backups are kept, and run the deletion again after any restore.

Suggested numbers:

| Keep backups for | Privacy notice can say | Trade-off |
|---|---|---|
| 7 days | "removed from backups within 7 days" | Little history to recover from; a mistake noticed after a week cannot be undone. |
| **30 days (recommended)** | "removed from backups within 30 days" | Fits inside GDPR's one-month answer window; storage stays tiny. |
| 90 days | "removed from backups within 90 days" | More history, but harder to justify for erasure requests. |

With R2, add one day of margin for the "within 24 hours" lifecycle delay (e.g. a 29-day rule for a "within 30 days" promise).

## Size check

OopsProof's database will be tiny (about 50 users). Even at a generous 5 MB per compressed daily copy, 30 copies are 150 MB, well under GitHub's 500 MB artifact allowance and R2's 10 GB.

## Open points

- Supabase's docs do not say whether a database connection from a backup job counts as "activity" that stops the Free project from pausing. Keep the planned keep-alive job anyway.
- Test a **restore** at least once (Supabase's guide shows the `psql --single-transaction` restore and suggests doing a test restore inside the backup job). [Supabase backup & restore] [Supabase GitHub Actions backups]
- The privacy notice should name where encrypted backups are stored (GitHub, or Cloudflare R2 EU).

## Sources (all checked 2026-11-16)

- [Supabase backups]: https://supabase.com/docs/guides/platform/backups
- [Supabase pausing]: https://supabase.com/docs/guides/platform/upgrading
- [CLI db dump]: https://supabase.com/docs/reference/cli/supabase-db-dump
- [Supabase GitHub Actions backups]: https://supabase.com/docs/guides/deployment/ci/backups
- [Supabase backup & restore]: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- [pg_dump]: https://www.postgresql.org/docs/current/app-pgdump.html
- [GitHub Actions billing]: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- [GitHub artifact retention]: https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization
- [GitHub download artifacts]: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts
- [GitHub remove artifacts]: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts
- [GitHub schedule event]: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- [R2 pricing]: https://developers.cloudflare.com/r2/pricing/
- [R2 get started]: https://developers.cloudflare.com/r2/get-started/
- [R2 data location]: https://developers.cloudflare.com/r2/reference/data-location/
- [R2 lifecycles]: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- [Backblaze pricing]: https://www.backblaze.com/cloud-storage/pricing
- [age]: https://github.com/FiloSottile/age
- [GDPR]: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- [EDPB 2026]: https://www.edpb.europa.eu/news/news/2026/edpb-identifies-challenges-hindering-full-implementation-right-erasure_en (full report: https://www.edpb.europa.eu/system/files/2026-02/edpb_cef-report_2025_right-to-erasure_en.pdf)
