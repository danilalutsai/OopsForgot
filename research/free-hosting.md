# Which free services can host and run OopsProof?

Research for issue #2. All facts were checked on **2026-11-15** against the official pricing, limits and docs pages linked below. Free tiers change often, so check them again before building.

## What OopsProof needs

- About 50 real users in the EU, with personal and family data, so the data should stay in an EU region (GDPR basics).
- Running cost of zero.
- Login, a Postgres-style database, and a few small files at most. The MVP has no photo upload.
- **Scheduled reminders.** Something has to wake up on a timer (at least daily) and send emails.

## Short answer

**Supabase Free, in an EU region (for example Frankfurt), plus a free email sender such as Resend, is the best fit.** It has login, a database, file storage and a built-in timer (Supabase Cron) all in one free plan, and 50 users is far below every limit. There are two things to plan around:

1. **Pausing.** Free projects are paused after 1 week of inactivity. With 50 real users this is unlikely, but a quiet week would pause the app, and its reminders would stop.
2. **Email.** Supabase's built-in email sends only 2 messages per hour, and only to your own team members. Real sign-up and reminder emails need a custom email sender. The Resend free plan allows 100 emails per day.

Firebase's free plan **cannot run scheduled code** (Cloud Functions need the paid Blaze plan), so it can't send reminders without paying or adding a workaround. A self-built stack (Nuxt on Vercel plus Neon Postgres) also works for free, but you have to build login, the database setup and the reminders yourself.

## Comparison

| | Supabase Free | Firebase Spark (free) | Self-built: Vercel Hobby + Neon Free |
|---|---|---|---|
| Login (monthly active users) | 50,000 MAU | 50,000 MAU (no phone/SMS login) | Build it yourself, or use Neon Auth: 60,000 MAU |
| Database | 500 MB Postgres per project | Firestore: 1 GiB stored; 50K reads, 20K writes, 20K deletes per day | Neon: 1 GB per project, 100 compute-hours/month |
| File storage | 1 GB | **Not on free plan** (Cloud Storage needs Blaze) | Neon Object Storage 5 GB, or Vercel Blob |
| Bandwidth | 5 GB, plus 5 GB cached | Firestore 10 GiB/month; Hosting 360 MB/day | Vercel 100 GB; Neon 5 GB per project |
| Server code | Edge Functions: 500,000 calls/month | **None** (Cloud Functions need Blaze) | Vercel Functions: 1M calls, 4 CPU-hours/month |
| Scheduled jobs (reminders) | Supabase Cron (pg_cron); can run SQL or call an Edge Function | **None on free plan** | Vercel Cron: up to 100 jobs, but **at most once a day**, and it can start up to 59 minutes late |
| Pausing when idle | **Paused after 1 week of inactivity**; restore with one click within the restore window | No pausing | Neon sleeps after 5 minutes idle and wakes in a few hundred ms (fine). Vercel does not pause. |
| EU region | Yes: Frankfurt, Ireland, Paris, Stockholm (also London and Zurich, which are outside the EU) | Yes: e.g. `eur3`, Frankfurt, Belgium. Location can't be changed later. | Neon: Frankfurt (`aws-eu-central-1`). Can't be changed later. |
| Backups | No automatic backups | Not covered | Neon: 6-hour history, 1 manual snapshot |
| Over the limit | Warning and grace period, then possible restrictions (paused, read-only, HTTP 402). No surprise bill. | Stops at the limit | Vercel: feature blocked until 30 days have passed. Neon: compute suspended until next month. |
| Other catches | 2 free projects. Built-in email unusable for real users (see above). Logs kept 1 day. | Needs a paid plan for the core feature | Hobby is "personal or non-commercial use" only (OopsProof qualifies). Logs kept 1 hour. |

## Other options checked

- **Cloudflare Workers + D1 (free):** 100,000 requests/day, 5 cron triggers, D1 5 GB storage, 5M row reads and 100K row writes per day. That's plenty, but each run is limited to **10 ms of CPU time**, and you build login yourself. This is a possible self-built host if Vercel's once-a-day timer is not enough.
- **Render free:** web services sleep after 15 minutes without traffic and take about 1 minute to wake. **Free Postgres is deleted 30 days after creation** (with a 14-day grace period), and cron jobs are not free. **Not suitable.**
- **Netlify free:** a 300-credit limit, and bandwidth costs 20 credits per GB. The pricing page doesn't clearly state the limits for functions or scheduled functions. Not checked further.
- **GitHub Actions scheduled workflow** (a free backup timer): it can call the app every 5 minutes or more, but runs can be late at busy times, and in a public repo the schedule turns off after 60 days without repo activity. Useful as a "ping" that keeps a Supabase project awake, or as a reminder timer for Firebase.

## Limits that would break ~50 real users

- **Firebase Spark: no scheduled code.** Reminders, a core MVP feature, need Cloud Functions plus a scheduler, which are on the paid Blaze plan only. Blaze needs a card on file, even if real usage stays inside its free amounts. **Dealbreaker for "zero cost, no card".**
- **Render free Postgres: deleted after 30 days.** **Dealbreaker.**
- **Supabase: pausing after 1 week of inactivity.** This is a real risk for a small app. Mitigation: a daily ping (GitHub Actions or a cron from another host). The Supabase docs don't define what counts as "activity", so test it first.
- **Supabase default email: 2 per hour, team members only.** Real users can't sign up by email until a custom email sender (SMTP) is set. Resend free: 3,000 per month, **100 per day**, which is enough for 50 users with one reminder email each per day.
- **Vercel Hobby cron: once a day, ±59 minutes.** Fine for "your bill is due in 3 days" reminders, but not for exact-time reminders.
- **Supabase Free has no automatic backups.** For real family data, plan a manual export (for example a scheduled `pg_dump` from GitHub Actions).

## Sources (all checked 2026-11-15)

- Supabase pricing: https://supabase.com/pricing
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Supabase billing FAQ (what happens over quota): https://supabase.com/docs/guides/platform/billing-faq
- Supabase restoring paused projects: https://supabase.com/docs/guides/platform/upgrading
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Firebase pricing: https://firebase.google.com/pricing
- Firestore locations: https://firebase.google.com/docs/firestore/locations
- Firebase project locations: https://firebase.google.com/docs/projects/locations
- Neon pricing: https://neon.com/pricing
- Neon regions: https://neon.com/docs/introduction/regions
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel fair use guidelines: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel cron pricing and limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel terms (Hobby is non-commercial, section 4): https://vercel.com/legal/terms
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Render free tier: https://render.com/docs/free
- Netlify pricing: https://www.netlify.com/pricing/
- Resend pricing: https://resend.com/pricing
- GitHub Actions schedule event: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows

## Not confirmed

- Whether every Supabase and Neon EU region can be picked on the free plan. The docs don't say, so check when creating the project.
- What exactly counts as "activity" for Supabase pausing, and whether Supabase's own cron jobs count.
- Whether Firebase Spark's 50K MAU applies to plain email/password login or only with Identity Platform. The pricing page groups them together.
