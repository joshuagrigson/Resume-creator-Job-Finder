# Decisions log

Joshua's picks from the decision panels on the HTML mocks. Newest round wins. Each pick is marked
**Shipped**, **Already true**, **Next** (waiting on the guided intake or the apply engine) or **Open**.

## Smart prompt — "Polish" (2026-09-23, second round)

Full detail: [DESIGN-SMART-PROMPT.md](DESIGN-SMART-PROMPT.md).

| Question | Pick | Status |
| --- | --- | --- |
| When the prompt appears | Both (pause + leaving the box) | Shipped |
| Fields he ignored at Next | Auto-clean + review screen | Next (guided intake) |
| Rule for rewrites | Reword only, never add facts | Shipped: prompt, plus a server check on numbers |
| Follow-up questions | Ask, max one per job | Shipped |
| What runs where | Browser for spelling, Claude for sentences | Shipped |
| Name | Polish | Shipped |
| Talk instead of type | Add a mic button | Shipped (hidden where the browser can't listen) |
| Keep his original words | Keep, on device only | Shipped (Undo polish) |

## Radius search (2026-09-23)

| Question | Pick | Status |
| --- | --- | --- |
| Default radius | 25 mi | Already true |
| Include remote by default | On | Already true |
| Sort after typing a ZIP | Relevance | Already true |
| Remember a home ZIP | Build it | Shipped. The first ZIP he searches becomes home. An empty box starts from home. A "Near home" chip brings it back, and the banner can make another ZIP home. |
| Postings that only say "Texas" / "USA" | Separate group | Shipped. His state first, then "USA only", up to 20 below the results. Vague postings for other states are dropped as elsewhere. |
| Miles or drive time | Miles | Already true |
| Remote only with a ZIP | Hide the radius controls | Shipped. Boards are asked for remote roles anywhere, and the ZIP only filters to roles open to US applicants. |
| Adzuna warning | Keep in banner | Already true |

## Résumé builder (2026-09-23)

| Question | Pick | Status |
| --- | --- | --- |
| Who writes the bullets | Claude, with rules as fallback | Next (guided intake). Polish already does the Claude half per field. |
| Showing a number to a first-timer | Number + label | Shipped. Match badges already read "82% · Strong", and the résumé score rings (editor, dashboard, tailor) now show the word under the number instead of "ATS" or nothing. |
| "Accept all" button | *(no pick)* | **Open** |
| Where editing lives | Sheet + form under "Advanced" | Next. The current editor becomes the "Advanced" view. |
| Intake length | 4 steps | Next (guided intake) |
| Templates offered | All 5 | Already true (classic, modern, minimal, executive, sidebar) |
| The summary | Offer as a fix | Next (guided intake) |
| ZIP in step 1 | Ask in step 1 | Next. It will set the home ZIP above. |

## Apply for me (2026-09-23)

| Question | Pick | Status |
| --- | --- | --- |
| Reach jobs in the queue | Same batch | Next (apply engine) |
| Daily limit | 10 a day | Next |
| "Check what goes out" screen | Always shown | Next. This is the gate before anything is sent, and it stays even at 10 a day. |
| "We send it" by email | Connect his email | Next. Needs Google and Microsoft OAuth apps. See the note below. |
| What counts as Reach | One requirement missing | Next (matching change) |
| Jobs that aren't a fit | Hidden, counted | Next |
| Pay question | Pre-fill from the jobs | Next |
| Follow-up | Remind at 7 days | Shipped. Marking a job Applied sets a follow-up 7 days out if none is set. The tracker and dashboard already surface due and overdue follow-ups. |

### Note on "Connect his email"

Sending from his own Gmail means a Google OAuth app with the `gmail.send` scope. Google treats
that as a sensitive scope, so the app must pass Google's verification before strangers can
connect: a privacy policy, a demo video and a domain he owns. Until then it works only for up to
100 test users he adds by hand. Outlook needs an Azure app registration with `Mail.Send`, and its
review is lighter. Neither costs money. Both take calendar time, so start them before the apply
engine is built. *Unverified: Google's current classification of `gmail.send`. Check it on
Google's OAuth scope page when registering.*

## Build order this implies

1. **Guided intake** (`/start`). It unlocks nine "Next" picks at once: 4 steps, ZIP in step 1
   (sets home ZIP), Polish on every box, auto-clean + review screen at Next, Claude writes the
   bullets with rules as fallback, summary offered as a fix, and a sheet-first result with the
   editor under "Advanced".
2. **Reach vs Qualified** in matching: one missing requirement = Reach; not a fit = hidden and counted.
3. **Apply engine**: a queue of 10 a day with Reach in the same batch, an always-shown review
   screen, pay pre-filled from the posting, and sending through his connected email.
