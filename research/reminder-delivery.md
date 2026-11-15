# How can Reminders reach users for free?

Research for issue #3 (map: issue #1). Checked on **2026-11-15** against first-party docs and pricing pages. Prices and free limits change; re-check before building.

## Short answer

Use **two channels, both free**:

1. **Web push** from the web app (PWA). Free, no Apple fee. On iPhone it works only after the user adds the app to the Home Screen (iOS 16.4 or later). On Android it works in Chrome without installing.
2. **Email** as a backup for people who do not install the app or turn off notifications. Brevo (300/day) or Resend (100/day, 3,000/month) both cover ~50 users.

Run the "who needs a Reminder now?" check with **Supabase Cron (pg_cron)** calling an Edge Function, for example every 15 minutes. It is the only free option that runs often and on time. Avoid Vercel Hobby cron (once a day, up to 59 minutes late), Firebase scheduled functions (need the paid Blaze plan with a card) and GitHub Actions cron (can be late or skipped).

A native app is not needed for Reminders, and on iPhone it would cost **$99 per year** (Apple Developer Program). That strongly favours web.

## 1. Web push (PWA)

| Fact | Source |
|---|---|
| Web push works for **Home Screen web apps on iOS/iPadOS 16.4 or later**, and in Safari 16 on macOS 13+. | [Apple: Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) |
| "You don't need to join the Apple Developer Program to send web push notifications." So: **free on iPhone**. | same Apple page |
| On iPhone, only a web app **added to the Home Screen** can ask for permission. The manifest must set `display` to `standalone` or `fullscreen`, or it is saved as a plain bookmark. | [WebKit blog: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| The permission request must come from a user tap (for example an "Enable reminders" button). | Apple page and WebKit blog above |
| Safari does not allow silent pushes. Every push must show a notification straight away, "If you don't, Safari revokes the push notification permission for your site." | Apple page above |
| If the phone is offline, Apple's push service can hold a message for **up to 30 days** (set by the `TTL` header), then deletes it. Only a limited number are stored. Use `Urgency: high` for Reminders. | Apple page above |
| Payload limit: 4 KB. Server signs requests with a **VAPID** key pair (made once, free). | Apple page above; [web.dev: Push notifications overview](https://web.dev/articles/push-notifications-overview) |
| Push API is "Baseline: widely available … since March 2023" (all major browsers). Needs an active service worker. | [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) |
| The browser vendor runs the push service (Apple, Google, Mozilla). Your server just sends an HTTPS request to it. No push provider account or fee is needed. The service worker can run "even when your website isn't open or the browser is closed." | [web.dev overview](https://web.dev/articles/push-notifications-overview) |
| **EU:** In early 2024 Apple planned to remove Home Screen web apps in the EU (iOS 17.4 beta), then reversed this before release. They kept working, with push, from iOS 17.4. The current Apple EU support page no longer mentions it. | [WebKit bug 268643](https://bugs.webkit.org/show_bug.cgi?id=268643); [Apple developer forum thread](https://developer.apple.com/forums/thread/748026) (secondary, for the timeline) |

**Caveats (reliability):**
- iPhone users must do the extra "Share → Add to Home Screen" step. Many people will not, so the app needs a clear in-app guide and an email fallback.
- The user can mute the app with Focus or in Settings, and the app cannot tell. Email backup covers this.
- Push subscriptions can expire (HTTP `410` from the push service). Delete them on the server and ask again.

## 2. Native push (Expo / FCM / APNs)

| Fact | Source |
|---|---|
| **Firebase Cloud Messaging is a no-cost product** (on every plan). | [Firebase pricing](https://firebase.google.com/pricing) |
| **Expo push service is free:** "There is no cost associated with sending notifications through Expo push notification service." Limit 600 notifications/second per project. | [Expo push FAQ](https://docs.expo.dev/push-notifications/faq/) |
| From Expo SDK 53, **Expo Go does not support push**. You need a development build, and on iOS your own push key. | Expo push FAQ above |
| Sending native push to iPhone (APNs) and shipping on the App Store or TestFlight needs the **Apple Developer Program: $99 per year**. | [Apple Developer Program](https://developer.apple.com/programs/); [Compare memberships](https://developer.apple.com/support/compare-memberships/) |
| Android: a Google Play developer account has a one-time fee (not checked here). An APK could be shared directly instead. | not verified |

**Conclusion:** Native push is free on Android, but on iPhone it breaks the zero-cost rule ($99/year). It also adds a second app to build and publish.

## 3. Free email sending

| Provider | Free limit | Notes | Source |
|---|---|---|---|
| **Brevo** | **300 emails/day** (~9,000/month), no time limit | API + SMTP included. New accounts must be approved before sending. | [Brevo free SMTP](https://www.brevo.com/free-smtp-server/), [Brevo transactional email](https://www.brevo.com/products/transactional-email/) (the pricing page did not render, so these are Brevo's own product pages) |
| **Resend** | **100/day, 3,000/month**, 3 domains, 30-day log retention | No pay-as-you-go on Free. Hard stop at the limit. | [Resend pricing](https://resend.com/pricing) |
| **Postmark** | **100/month**, never expires | Too small for daily Reminders. | [Postmark pricing](https://postmarkapp.com/pricing) |
| **Supabase built-in email** | **2 per hour**, only to project team members | "best-effort only", for testing. Needs custom SMTP (for example Brevo or Resend) for real users, including sign-up emails. | [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| **Firebase Auth emails** | Only sign-in and verification templates | Not a general email sender (not checked in depth). | not verified |

**Size check:** 50 users × a few Reminders a day is far under 100/day. Sign-up and password emails share the same limit when that provider is also the Supabase SMTP. All need a domain you own (with DNS records) for good delivery. A domain usually costs money, unless you already have one. See the deploy and domain question on the map.

## 4. Running the reminder job on time

| Option | Free? | How often / how exact | Source |
|---|---|---|---|
| **Supabase Cron (pg_cron) → Edge Function** (via `pg_net` `http_post`) | Yes, Free plan includes 500,000 Edge Function calls | Any schedule from every second to yearly. Recommended: no more than 8 jobs at once, each under 10 minutes. | [Supabase Cron](https://supabase.com/docs/guides/cron), [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase pricing](https://supabase.com/pricing) |
| **Cloudflare Workers Cron Triggers** | Yes, 5 cron triggers per account on Workers Free, 100k requests/day, 10 ms CPU | Per-minute expressions allowed. Runs "on underutilized machines", no exact-time promise. | [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **Vercel Cron (Hobby)** | Yes | **Once per day only**, and it fires anywhere in that hour (±59 min). | [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) |
| **Firebase scheduled functions** | **No.** Cloud Functions need the **Blaze** (pay-as-you-go, card) plan. There is a monthly no-cost quota, and 3 Cloud Scheduler jobs are free per Google account. | Fine timing, but a billing account is a cost risk. | [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Schedule functions](https://firebase.google.com/docs/functions/schedule-functions) |
| **GitHub Actions `schedule`** | Yes | At most every 5 minutes. "Can be delayed during periods of high loads", "some queued jobs may be dropped". Disabled after 60 days with no repo activity (public repos). | [GitHub: Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) |

**Supabase Free plan risk:** "Free projects are paused after 1 week of inactivity", with a limit of 2 active projects ([pricing](https://supabase.com/pricing)). The docs do not say whether a cron job counts as activity. With ~50 real users this should not happen, but check it during building.

**Design tip:** Do not set one exact timer per Reminder. Run one job every 5–15 minutes that finds Reminders whose send time has passed and that are not yet sent. Send them and mark them sent. A late or missed run then catches up on the next one.

## What this means for the decision

- **Web app (PWA) + web push + email fallback + Supabase Cron** meets "zero running cost" and "Reminders before due dates" for ~50 EU users.
- **The main cost of native is Apple's $99/year** for iPhone push. Web push on iPhone is free, but only after Home Screen install (iOS 16.4+).
- Open item: an email sending domain. A custom domain may cost money unless one is already owned.
