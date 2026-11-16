# Can Supabase Auth send login emails through a Gmail account?

Research for issue #26 (map: issue #1). Checked on **2026-11-16** against first-party pages (Google Gmail Help, Google Account Help, Google Workspace Help, Google Terms, Supabase docs, Microsoft). Google changes sign-in rules often, so check again before setting it up.

## Short answer

**Yes, it works, and it is free.** Supabase Auth accepts any SMTP server. Gmail's SMTP server (`smtp.gmail.com`) accepts a personal Gmail account that has 2-Step Verification turned on and an **app password** (a 16-character password made just for one app). Supabase has a help page showing Gmail SMTP working, though it was tested with a Workspace account, not a free one.

**But it is a stopgap, not a home.**

- **Limit:** about **500 emails a day**. If we go over it, or many emails bounce, Gmail stops sending for 1 to 24 hours.
- **Terms:** Google's rules do not ban this, but they do not plan for it either. App passwords are "not recommended" by Google and might stop working one day. Google can disable an account it thinks is breaking its rules. That would stop logins for everyone until we fix it.
- **Looks:** recipients see something like `OopsProof <oopsproof.app@gmail.com>`. The name is ours, but the address is a plain Gmail one.
- **Deliverability:** probably fine at our size. The mail really comes from Gmail's servers, so it passes Gmail's own checks. No send test has been done yet.
- **Fallback:** buy the domain (about $11/year) and use Brevo, as decided in issue #16. Moving later is only a settings change in the Supabase dashboard.

## 1. Gmail SMTP settings and what Google requires

| Fact | Source |
|---|---|
| Outgoing server `smtp.gmail.com`, needs SSL/TLS and sign-in. Port **587** (STARTTLS). Username is the full Gmail address. | [Gmail Help: Add Gmail to another email client (IMAP settings)](https://support.google.com/mail/answer/7104828) |
| Ports **465** (SSL) and **587** (TLS) for `smtp.gmail.com`. | [Workspace Help: Send email from a printer, scanner or app](https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app) |
| "Gmail no longer supports third-party apps or devices which require you to share your Google username and password." The normal account password will not work. | [Gmail Help: Add Gmail to another email client](https://support.google.com/mail/answer/7126229) |
| "App passwords can only be used with accounts that have 2-Step Verification turned on." The option is missing if 2-Step Verification uses only security keys, or the account has Advanced Protection. | [Google Account Help: Sign in with app passwords](https://support.google.com/accounts/answer/185833) |
| Google says app passwords "aren't recommended and are unnecessary in most cases". The page does not say they are being retired. | same |
| Google **revokes all app passwords when the account password changes**. After a password change, we must make a new app password and paste it into Supabase. | same |
| OAuth ("Sign in with Google") is Google's preferred way. Supabase's SMTP settings only take a username and password, so OAuth is **not an option** here. | [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) (fields: host, port, user, password, sender email, sender name) |
| Supabase's troubleshooting page confirms Gmail SMTP works: use an **app password**, ports 465 or 587 both worked on `smtp.gmail.com`, and the sender email must equal the SMTP username. It was tested on a Google **Workspace** trial account, not a free Gmail one, and was "figured out through trial and error". | [Supabase: Using Google SMTP with Supabase Custom SMTP](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y) |

**Settings to enter in Supabase (Authentication > Emails > SMTP Settings):**

| Field | Value |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `465` (or `587`) |
| Username | the full Gmail address, for example `oopsproof.app@gmail.com` (name is an example, availability not checked) |
| Password | the 16-character app password |
| Sender email | the same Gmail address |
| Sender name | `OopsProof` |

## 2. Sending limit

| Fact | Source |
|---|---|
| Gmail stops sending if you send "more than 500 emails sent in a day" or one email to more than 500 recipients. You can send again "within 1 to 24 hours". | [Gmail Help: You have reached a limit for sending mail](https://support.google.com/mail/answer/22839) |
| Many bounces (invalid addresses, rejected mail) can also block sending for about 24 hours. | same |
| Google publishes no separate limit for SMTP on free accounts. The 2,000/day figure is for paid Workspace accounts only. Workspace trials get 500/day. | [Workspace Help: Gmail sending limits in Google Workspace](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) |
| With custom SMTP, Supabase itself starts at **30 emails per hour**. This can be changed under Authentication > Rate Limits. | [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |

For about 50 users, login emails are a handful per day, far below 500. A bot signing up with fake addresses could cause bounces and trip the block, so keep Supabase's hourly limit low and use CAPTCHA if abuse shows up.

## 3. Do Google's rules allow it?

No rule forbids it outright, but nothing invites it either. It is a grey area.

| Fact | Source |
|---|---|
| Gmail Program Policies (updated 2026-10-20) ban spam and "unsolicited commercial mail", and say "You are not allowed to automate the Gmail interface, whether to send, delete, or filter emails". Login emails the user asked for are not spam. SMTP is an official way in, not the Gmail interface, but Google does not say so directly. | [Gmail Program Policies](https://support.google.com/mail/answer/16734397) |
| The policies do not mention app-generated account emails (sign-up confirmation, password reset) at all. | same |
| "Google may disable accounts that are found to be in violation of our policies", including "limiting or terminating a user's access". | same |
| Google Terms (effective 2026-07-30): a "consumer" uses the services for "personal, non-commercial purposes". Businesses agree to the terms as an organization. Spamming and "bypassing our systems or protective measures" are abuse. Google can act if we "materially or repeatedly breach these terms". | [Google Terms of Service](https://policies.google.com/terms) |
| The sender guidelines list "Using an @gmail.com domain as the display name for bulk email" as a spoofing practice. We would not be bulk (under 5,000/day), and the mail is really sent by the Gmail account, so this does not apply. | [Gmail: Email sender guidelines](https://support.google.com/mail/answer/81126) |

**Reading:** OopsProof is a free, non-commercial hobby app, and its login emails are wanted by the person who gets them. That fits the rules as written. The real risk is not a rule but **Google's automated abuse systems**. A new account that suddenly sends many similar emails to strangers can look like spam and be locked. If that happens, nobody can sign up or reset a password until we switch providers.

## 4. How the email looks to recipients

| Fact | Source |
|---|---|
| Supabase sends with the "sender email" and "sender name" we set. | [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| Gmail only lets an account send "as" an address it owns or has verified. For a third-party address, Outlook users may see "yourname@gmail.com on behalf of othername@…". Gmail ends "Send as" for third-party addresses in January 2027. | [Gmail Help: Send emails from a different address or alias](https://support.google.com/mail/answer/22370) |

So recipients will see **`OopsProof <oopsproof.app@gmail.com>`**. The display name is ours; the address must be the Gmail account itself. There is no way to show `@oopsproof.pages.dev`, because we cannot own that domain. Links in the email will point to the `xxxx.supabase.co` address (a Supabase custom domain is a paid add-on, see issue #16 notes).

Replies go to the Gmail inbox, which is a bonus: we can read them.

## 5. Deliverability to Gmail, Outlook and Yahoo

| Fact | Source |
|---|---|
| All senders to Gmail need SPF or DKIM, TLS and a spam rate under 0.3%. The stricter rules (SPF **and** DKIM, DMARC) apply only to senders of 5,000+ emails a day. | [Gmail: Email sender guidelines](https://support.google.com/mail/answer/81126) |
| Outlook.com's strict rules (SPF, DKIM, DMARC) apply to "domains sending more than 5,000 emails per day". Failing mail goes to Junk since 2025-05-05. | [Microsoft: Outlook's new requirements for high-volume senders](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730) |
| DNS lookup on 2026-11-16: `gmail.com` publishes SPF (`v=spf1 redirect=_spf.google.com`) and DMARC `p=none; sp=quarantine`. | own `dig` lookup |

Mail sent through `smtp.gmail.com` really leaves from Google's servers as a `@gmail.com` address, so Google signs it and it matches gmail.com's SPF. This is the normal case for any Gmail user, so it should pass the checks at Gmail, Outlook and Yahoo. (This is how Gmail works for everyone; we have not yet confirmed it with a test send. **Send a test to a Gmail, an Outlook and a Yahoo address and check "show original" for SPF/DKIM/DMARC = PASS.**)

Weak spots: a brand-new Gmail account has no history, and an automated-looking email ("Confirm your email") from a personal address can land in spam more often than one from a real domain. At our tiny volume this is a minor risk, not a blocker.

## 6. Fallback if Gmail refuses or blocks it

| Option | Cost | Notes |
|---|---|---|
| **Brevo SMTP with our own domain** (decided in issue #16) | about $11.17/year for the domain | Supabase lists Brevo by name. 300 emails/day free, shared with Reminder emails. Proper `@oopsproof.<tld>` address. |
| Other providers Supabase lists (Resend, Postmark, AWS SES, SendGrid, ZeptoMail) | free tiers vary | All of them also want our own domain for good delivery. |
| Supabase built-in email | free | Only reaches project team members, 2 emails/hour. Useless for real users. ([Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)) |

Switching is just new values in the same Supabase SMTP form. No code changes. Keep the Gmail account's recovery phone and email set so we can win it back if Google locks it.

## What this means for the decision

- **Gmail SMTP is a good free start** while we have no domain: confirm email, reset password and change email will all go out, up to about 500 a day.
- **Set up:** new Gmail account just for OopsProof, turn on 2-Step Verification (with a phone or authenticator app, not only a security key), make an app password, enter the settings above in Supabase. Do not change the account password later without updating Supabase.
- **Accept:** a plain `@gmail.com` sender, a small chance Google locks the account, and app passwords that Google might retire.
- **Plan the exit:** when we buy a domain (needed anyway for Brevo Reminder emails), move login emails to Brevo too.
- Open items: a real send test to Gmail, Outlook and Yahoo; confirm the app-password option shows on a fresh free account.
