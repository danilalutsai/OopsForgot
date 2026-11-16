# Does sending email through Brevo need our own domain, and what does one cost?

Research for issue #16 (map: issue #1). Checked on **2026-11-16** against first-party docs (Brevo help center, Google, Yahoo, Supabase, Cloudflare, Verisign). Prices and free limits change, so check again before buying.

## Short answer

**Yes, we need our own domain.** Brevo will not send "from" a free address like `@gmail.com`. It swaps the address for an odd one like `oopsproof@5000001.brevosend.com`. Brevo calls this a temporary stopgap, and the inbox shows a strange sender. Gmail, Yahoo and Microsoft now expect senders to sign their mail with their own domain (DKIM and DMARC, two DNS records that prove the mail is really from us). Microsoft marks unsigned mail as spam or rejects it.

**Cost: about $11.17 per year** for a `.com` at Cloudflare Registrar. Cloudflare sells at cost with no markup, and renewal is the same price. That is the only new running cost. Everything else stays free:

- **One domain covers everything.** The app on Cloudflare Pages (`oopsproof.com`), Reminder emails and login emails can all use it, each from its own sub-address such as `auth.oopsproof.com`.
- **Supabase Auth emails** (confirm email, reset password, change email) can go through Brevo SMTP. Supabase supports this and lists Brevo by name. They share Brevo's 300 emails/day free limit with Reminders.
- **Free subdomains** (eu.org, is-a.dev) are not a good fit. See section 4.

## 1. Brevo: free addresses and domains

| Fact | Source |
|---|---|
| "You can only authenticate a domain that you or your business own and control. Domains from free email services, such as Gmail or Yahoo … cannot be authenticated. If you don't have your own domain yet, you will need to purchase one." | [Brevo: Authenticate your domain](https://help.brevo.com/hc/en-us/articles/12163873383186) (updated 2026-11-14) |
| If the domain is not authenticated, Brevo replaces it: "your email address will appear with a format similar to mycompany@5000001.brevosend.com". "Brevo also replaces email addresses from free email providers, such as gmail.com, because they cannot be authenticated." Brevo calls it a temporary way to "help maintain your deliverability". | [Brevo: Troubleshooting – Domain authentication](https://help.brevo.com/hc/en-us/articles/16045394674066) (updated 2026-11-13) |
| "Sending from a free email address (@gmail.com, @yahoo.com, @outlook.com, etc.) will cause your emails to be rejected or filtered to spam." | [Brevo: Comply with Gmail, Yahoo, and Microsoft's requirements](https://help.brevo.com/hc/en-us/articles/14925263522578) (updated 2026-11-06) |
| "If your domain is not authenticated with DMARC, all emails sent to Microsoft recipients (@outlook.com, @hotmail.com, and @live.com) will be marked as spam or rejected." | same Brevo article |
| Authentication means adding 3–4 DNS records: a Brevo code (proves we own the domain), DKIM (signs each email) and DMARC (tells inboxes what to do with mail that fails the check). Brevo can add them automatically by logging in to the domain provider. | [Brevo: Authenticate your domain](https://help.brevo.com/hc/en-us/articles/12163873383186) |
| Brevo recommends sending from a **subdomain** (for example `hello@news.yourcompany.com`) so that problems with sending do not hurt the main domain. The domain you send from and the domain you authenticate must match. If they don't, Brevo again swaps in `brevosend.com`. | [Brevo: Domain setup for better email deliverability](https://help.brevo.com/hc/en-us/articles/35852083084178) (updated 2026-11-04) |

**Side check (DNS lookup on 2026-11-16):** `yahoo.com` publishes DMARC `p=reject`, so mail claiming to be from `@yahoo.com` but sent by Brevo would be rejected. `gmail.com` and `outlook.com` publish `p=none` with `sp=quarantine`. Brevo rewrites free addresses anyway, so this does not change the answer.

## 2. Brevo free plan

| Fact | Source |
|---|---|
| **300 emails per day**, with no time limit. Unused sends do not carry over. Transactional emails over the limit: "up to 1,000 additional emails are held in a retry queue. Emails beyond this queue are not delivered." | [Brevo: FAQs – limits of the Free plan](https://help.brevo.com/hc/en-us/articles/208580669) (updated 2026-11-09) |
| Free plan "is completely free forever. No credit card required". It includes "Transactional emails and SMS". | [Brevo: About Brevo's pricing plans](https://help.brevo.com/hc/en-us/articles/208589409) (updated 2026-11-09) |
| **Branding:** "Emails sent from the Free plan always include the Sent with Brevo sticker." Removing it needs Starter ($9/month and up) with an add-on, or Standard ($18/month and up). | same two Brevo articles; [Will my contacts know that I'm using Brevo?](https://help.brevo.com/hc/en-us/articles/209429285) |
| SMTP: ports 587 or 2525 (or 465 with SSL/TLS). Log in with an **SMTP key**, not an API key. The host and login are shown in Brevo settings. The sender "must be registered and verified". | [Brevo developers: SMTP integration](https://developers.brevo.com/docs/smtp-integration); [Send a transactional email](https://developers.brevo.com/docs/send-a-transactional-email) |

Not confirmed: whether the "Sent with Brevo" sticker also appears on emails sent through the API or SMTP (Reminder and login emails), or only on campaigns. The FAQ says "emails sent from the Free plan", while the logo article talks about campaigns. **Send a test email to check.**

## 3. Gmail and Yahoo rules for senders

| Rule | Who it applies to | Source |
|---|---|---|
| SPF **or** DKIM on the sending domain, spam complaint rate under 0.3%, TLS, valid PTR. "Don't impersonate Gmail From: headers." In force since **2024-02-01**. | All senders to Gmail | [Google: Email sender guidelines](https://support.google.com/a/answer/81126) |
| SPF **and** DKIM, DMARC (`p=none` is enough), From domain aligned with SPF or DKIM, one-click unsubscribe for marketing mail | Senders of 5,000+ emails/day | same Google page |
| "Implement SPF or DKIM at a minimum." | All senders to Yahoo | [Yahoo Sender Hub: best practices](https://senders.yahooinc.com/best-practices/) |
| SPF and DKIM, DMARC at least `p=none` that must pass, aligned From, unsubscribe | Yahoo bulk senders | same Yahoo page |
| Microsoft announced similar rules in May 2025 | Outlook / Hotmail | Brevo articles above |

OopsProof sends far fewer than 5,000 emails a day, so only the basic rules apply. Even those need a domain we control, because we can only add SPF or DKIM records to our own domain.

## 4. Free subdomains

| Option | Finding | Source |
|---|---|---|
| `*.pages.dev` (the free Cloudflare Pages address) | Cloudflare owns it, so we cannot add the DNS records Brevo needs. | (follows from the Brevo ownership rule above) |
| `is-a.dev` | Free and allows MX/TXT records, but root subdomains "must relate to software development as required in our Terms of Service". A consumer app does not fit. | [is-a.dev FAQ](https://docs.is-a.dev/faq/) |
| `eu.org` | Free subdomains "to users or non-profit organizations". The homepage gives no approval time. Approval is commonly said to take weeks or months (not verified). | [nic.eu.org](https://nic.eu.org/) |

**Conclusion:** Technically, a free subdomain we fully control could pass Brevo's checks. But approval is slow or the use is not allowed, the shared names have a weak reputation, and it saves only about $11 a year. Not recommended.

## 5. Domain price (Cloudflare Registrar)

| Fact | Source |
|---|---|
| "Cloudflare Registrar does not mark up domain prices at all". Renewals are also at cost. Free WHOIS privacy (hides our personal details from the public domain owner lookup), DNSSEC, DNS and SSL. | [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/); [Cloudflare docs: About Registrar](https://developers.cloudflare.com/registrar/about/) |
| Verisign (the company that runs `.com`) raised its wholesale `.com` fee "from $10.26 to $10.97 effective Nov. 1, 2026". The contract allows up to 7% more each year in 2027–2029. | [Verisign Q1 2026 results](https://investor.verisign.com/news-releases/news-release-details/verisign-reports-first-quarter-2026-results) |
| So a `.com` at Cloudflare is about **$11.17/year** ($10.97 + $0.20 ICANN fee), the same price to renew. Third-party price checks from 2026-11-02 show this figure. **Look at the live price in the Cloudflare dashboard before buying.** | derived; [startupowl review](https://startupowl.com/reviews/cloudflare-registrar) (secondary) |
| Registering needs a payment method (card). "All domains acquired via Cloudflare Registrar use Cloudflare nameservers", which is what Pages needs anyway. | [Cloudflare docs: Register a domain](https://developers.cloudflare.com/registrar/get-started/register-domain/) |
| Other endings (`.xyz`, `.site`) are no cheaper at Cloudflare over the years. Other registrars have $1–5 first-year deals, but they renew at a higher price. | secondary price comparisons (not verified) |

## 6. Same domain for the app on Cloudflare Pages

| Fact | Source |
|---|---|
| An apex domain (`oopsproof.com`) on Pages must use Cloudflare nameservers, which is automatic with Cloudflare Registrar. A subdomain (`app.oopsproof.com`) only needs a CNAME record pointing to `<project>.pages.dev`. | [Cloudflare Pages: Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/) |
| The free plan allows 100 custom domains per Pages project. | [Cloudflare Pages: Limits](https://developers.cloudflare.com/pages/platform/limits/) |
| **Cloudflare Email Routing** (free) can forward incoming mail (for example replies to `hello@oopsproof.com`) to a personal inbox. It does not send mail. | [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) |

One domain can hold the website records, the Brevo records and the Email Routing records together without conflict.

## 7. Supabase Auth emails through Brevo

| Fact | Source |
|---|---|
| Supabase's built-in email is for testing only. It "will refuse to deliver messages to addresses that are not part of the project's team" and is limited to **2 per hour**. Real sign-ups need custom SMTP. | [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp); [Supabase: Rate limits](https://supabase.com/docs/guides/auth/rate-limits) |
| Brevo is named in Supabase's list of SMTP providers. The settings needed are host, port, user, password and a From address such as `no-reply@example.com`. | [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| With custom SMTP, Supabase starts at a low limit of **30 emails per hour**, which can be changed under Authentication > Rate Limits. | same |
| Supabase advises a **separate sending subdomain for auth email** (`auth.example.com`) and setting up DKIM, DMARC and SPF for it. | same |
| A custom domain for the Supabase project itself (so links in emails show our domain instead of `xxxx.supabase.co`) is a **paid add-on, not on Free**. Auth links will show the `supabase.co` address. That is fine, just less polished. | [Supabase: Custom domains](https://supabase.com/docs/guides/platform/custom-domains) |

## What this means for the decision

- **Budget about $11–12 per year for one `.com` domain** at Cloudflare Registrar. This is the only cost, and it also gives the app a proper web address.
- Suggested setup (name is an example, availability not checked): `oopsproof.com` (app on Pages), `reminders.oopsproof.com` (Brevo, Reminder emails), `auth.oopsproof.com` (Brevo SMTP for Supabase Auth). Authenticate both in Brevo with DKIM and DMARC. Use Cloudflare Email Routing for replies.
- Reminder and auth emails share Brevo's **300/day**. Fine for about 50 users, but watch it if sign-ups spike.
- Free plan emails carry the "Sent with Brevo" sticker. This is a cosmetic cost of staying free. Check with a test send whether it shows on Reminder and auth emails.
- Open items: the live price when buying, the name for the domain, and the sticker test.
