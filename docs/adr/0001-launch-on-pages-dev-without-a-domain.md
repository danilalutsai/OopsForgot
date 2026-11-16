# Launch on pages.dev without a domain, with push-only Reminders

OopsProof launches at `oopsproof.pages.dev` (Cloudflare Pages) with no domain of its own, to keep running costs at zero while only the owner and family use it. Without a domain, Reminder emails can't pass Gmail/Yahoo/Outlook sender checks (DKIM/DMARC need a domain we own), so Reminders go by push only and login emails are sent from a dedicated Gmail account instead of Brevo. A `.com` (about $11.17/year) is bought before the app is shared with anyone outside the family; that move changes the web address, so every user reinstalls the PWA and allows push again, which is why it happens while users are few.

## Considered Options

- **GitHub Pages at `danilalutsai.github.io/OopsProof`**: rejected. Needs a base path and a 404.html workaround, can't set security headers, and shares an origin (browser storage, service worker scope) with the owner's portfolio site.
- **Buy the domain at launch**: rejected for now on cost; email Reminders and the iPhone email fallback wait for it.

## Consequences

- iPhone users who don't add the app to their Home Screen get no Reminders until the domain is bought.
