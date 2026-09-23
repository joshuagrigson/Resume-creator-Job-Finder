# Decisions log

Joshua's picks from the decision panels on the HTML mocks. Newest round wins. Each pick is marked
**Shipped**, **Already true**, **Next** (waiting on the guided intake or the apply engine) or **Open**.

## Smart prompt — "Polish" (2026-09-23, second round)

Full detail: [DESIGN-SMART-PROMPT.md](DESIGN-SMART-PROMPT.md).

| Question | Pick | Status |
| --- | --- | --- |
| When the prompt appears | Both (pause + leaving the box) | Shipped. The pause is 1.2 s after a finished sentence, 2.5 s mid-thought, and skipped for edits under 12 characters. |
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
| Pay question | Pre-fill from the jobs | Shipped as `payAnswerFor()`: the **top** of a posted range, never the floor, shown with its reason in the job detail. The apply review screen will reuse it. |
| Follow-up | Remind at 7 days | Shipped. Marking a job Applied sets a follow-up 7 days out if none is set. The tracker and dashboard already surface due and overdue follow-ups. |

### Note on "Connect his email"

Checked 2026-09-23: `gmail.send` is a **Sensitive** scope (Google's Gmail scopes page). That means
OAuth verification but no paid security assessment. In Testing mode it works for up to 100 listed
test users with no verification, which is enough to build and test the apply engine. The privacy
policy and terms Google requires are live at `/privacy` and `/terms` and linked from every page.
Step-by-step registration for Google and Microsoft: [EMAIL-CONNECT.md](EMAIL-CONNECT.md).

## Build order this implies

1. **Guided intake** (`/start`). It unlocks nine "Next" picks at once: 4 steps, ZIP in step 1
   (sets home ZIP), Polish on every box, auto-clean + review screen at Next, Claude writes the
   bullets with rules as fallback, summary offered as a fix, and a sheet-first result with the
   editor under "Advanced".
2. **Reach vs Qualified** in matching: one missing requirement = Reach; not a fit = hidden and counted.
3. **Apply engine**: a queue of 10 a day with Reach in the same batch, an always-shown review
   screen, pay pre-filled from the posting, and sending through his connected email.
