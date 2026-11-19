# Launch checklist

Run it before inviting new people, and again after big releases. Record each run on the release's
GitHub issue (the first one: #51).

## Automated: every push to `main`

The CI checks and the deploy's live check cover these; nothing to do by hand while they're green.

- Types, lint, unit tests (shared rules), integration tests (database rules, Edge Functions)
- End-to-end tests on phone Chrome, phone Safari (WebKit) and computer Chrome, with an
  accessibility check (axe), including offline read-only mode and push set-up
- Live check after the deploy: the app loads, the Reminder sender refuses strangers, the
  Calendar feed refuses bad links, the push key is valid

## Live site: an agent can check these without logging in

- [ ] Security headers on the app (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
      Referrer-Policy, Permissions-Policy)
- [ ] `http://` redirects to `https://`
- [ ] Service worker, manifest (name, standalone, icons) and app icons are served
- [ ] Deep links (`/settings`, `/account`, `/privacy`, `/items/…`) open the app
- [ ] The Privacy notice names a real contact address (`app/src/contact.ts`)
- [ ] The newest daily backup run succeeded (`oopsproof-backups` → Actions)

## Real devices: only the owner

- [ ] **iPhone:** open the app in Safari → Share → Add to Home Screen → open it from the Home
      Screen → Settings → Push → turn on → allow. Add an Item due in 2 hours with a Reminder
      "1 hour before"; the push arrives on time and opens the Item.
- [ ] **Android:** the same in Chrome (Install app), push arrives.
- [ ] **Login emails:** sign up and reset the password with a Gmail, an Outlook and a Yahoo
      address; each email lands in the inbox, not in spam, and its link works.
- [ ] **Calendar feed:** Settings → Calendar feed → turn on → copy the link. Google Calendar
      (computer) → Other calendars → From URL; Apple Calendar → File → New Calendar
      Subscription. Due dates show up (Google can take up to a day to refresh).
- [ ] **Offline:** on the phone, open the app, then turn on airplane mode: Items still show,
      changes are blocked with a message, and everything works again once back online.
- [ ] **Restore test** (every 6 months): `RESTORE.md` in `oopsproof-backups`.
