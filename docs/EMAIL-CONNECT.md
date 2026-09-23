# "We send it" — connecting his Gmail or Outlook

Joshua's pick: applications go out from the applicant's own email account. Only permission to
**send** is requested. Nothing is ever read.

## What Google actually requires (checked 2026-09-23)

- `https://www.googleapis.com/auth/gmail.send` is a **Sensitive** scope, not Restricted (Google's
  Gmail scopes page). Sensitive means OAuth app verification, but **not** the paid third-party
  security assessment that Restricted scopes need.
- Verification needs:
  - a homepage on a domain you own, verified in Google Search Console
  - a privacy policy on the same domain, linked from the homepage
  - a demo video of the full OAuth flow
  - a written justification for why a narrower scope wouldn't work
- **Before verification**, the app runs in *Testing* mode. Only test users you list (up to 100)
  can connect, and they see an "unverified app" warning. That's enough to build and test the apply
  engine end to end with his own Gmail. Verification is only needed before strangers use it.

Already done in the repo:

- `/privacy` and `/terms` exist (`public/privacy.html`, `public/terms.html`).
- Both are linked from the footer of every page, including the homepage.
- The privacy page carries Google's Limited Use statement.

Its contact line still reads `SUPPORT_EMAIL` until an address is chosen.

**Domain.** Google wants a domain you own. `*.workers.dev` is a shared Cloudflare domain; whether
Google accepts a subdomain of it for verification is **unverified**. The safe path is a real
domain, about $10/year through Cloudflare Registrar. That's a spending decision, and it's only
needed before verification, not for Testing mode.

## HANDS NEEDED — Google (pre-approved — paste, don't review)

Do this after the Cloudflare deploy (docs/CLOUDFLARE.md), so the Worker's address exists.

1. Create the project: https://console.cloud.google.com/projectcreate. Project name: `Launchpad`.
2. Turn on the Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com → Enable.
3. Set up the consent screen: https://console.cloud.google.com/auth/overview → Get started.

   ```text
   App name:            Launchpad
   User support email:  (the address you choose for SUPPORT_EMAIL)
   Audience:            External
   Contact email:       (same)
   ```

4. Add the scope: https://console.cloud.google.com/auth/scopes → Add or remove scopes → paste
   `https://www.googleapis.com/auth/gmail.send` → Update → Save.
5. Add test users: https://console.cloud.google.com/auth/audience → Test users → Add users → his
   Gmail address.
6. Create the client: https://console.cloud.google.com/auth/clients → Create client → Web application.

   ```text
   Name:                          Launchpad web
   Authorized JavaScript origins: https://launchpad.<your-workers-subdomain>.workers.dev
                                  http://localhost:5173
   Authorized redirect URIs:      https://launchpad.<your-workers-subdomain>.workers.dev/api/auth/google/callback
                                  http://localhost:8787/api/auth/google/callback
   ```

7. Copy the Client ID and Client secret into the Cloudflare Worker as secrets named
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

The callback route is built with the apply engine. Registering now is what starts the clock, and
the redirect URIs can be edited later.

**Scope justification** (paste this when you submit for verification):

```text
Launchpad sends job applications on the user's behalf from their own Gmail account. Before
anything is sent, the user reviews each application (recipient employer, subject, message, and
attached résumé) on a confirmation screen and approves it; nothing is sent without that approval,
and sending is limited to 10 applications per day. We request gmail.send only: we never read,
search, modify or delete mail. Narrower options do not work for this: there is no Gmail scope
narrower than gmail.send that can send a message, and sending through our own mail server instead
would come from an address the employer does not recognize, so replies would not reach the
applicant's inbox.
```

## HANDS NEEDED — Microsoft (Outlook, Hotmail, Live)

1. Register the app: https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade → New registration.

   ```text
   Name:                     Launchpad
   Supported account types:  Accounts in any organizational directory and personal Microsoft accounts
   Redirect URI (Web):       https://launchpad.<your-workers-subdomain>.workers.dev/api/auth/microsoft/callback
   ```

2. Add permissions: API permissions → Add a permission → Microsoft Graph → Delegated → `Mail.Send`,
   `offline_access`, `openid`, `email` → Add.
3. Create a secret: Certificates & secrets → New client secret → copy the **Value** into the Worker
   as `MS_CLIENT_ID` (the Application ID on the Overview page) and `MS_CLIENT_SECRET`.

*Unverified:* whether a personal Microsoft account can register apps without first creating a
free Azure tenant. If the Entra page asks for a tenant, the free Azure sign-up creates one.
