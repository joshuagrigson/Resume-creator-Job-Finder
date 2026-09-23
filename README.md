# Launchpad — Resume Builder + Job Finder

Launchpad is one app for the two halves of a job search that normally live in different tabs: it builds an ATS-ready resume with a live preview and a score that tells you exactly what to fix, then searches eight public job boards at once and ranks every result against *that* resume — so "how well do I match this?" stops being a guess. Save the good ones to a kanban tracker, tailor your resume to a specific posting with a keyword gap report (and optional AI suggestions), and export to PDF, DOCX or JSON. Everything you write stays in your browser: there is no account, no database, and nothing is uploaded unless you deliberately use an AI feature.

---

## Features

### Resume builder
- **Five templates** — classic, modern, minimal, executive and sidebar. All are text-based single- or two-column layouts that an ATS can parse.
- **Live preview** at real page size (US Letter or A4), honouring accent colour, font family, font size, density and section order.
- **Drag-to-reorder sections** with keyboard fallbacks; hide a section without deleting its content; add your own custom sections.
- **ATS score** out of 100 across contact details, summary, experience quality (action verbs, quantified bullets, bullets per role, recency), skills, education, formatting and — when you supply a job description — keyword coverage. Every issue comes with a concrete fix.
- **Export** to PDF (print-based, so it matches the preview exactly), DOCX (ATS-friendly single column) and JSON.
- **Import** from pasted resume text (heuristic parser), a Launchpad JSON file, a full export bundle, or a [JSON Resume](https://jsonresume.org/) file.
- **Multiple resumes** — duplicate, rename and switch between tailored versions.

### Job finder
- **Nine boards aggregated** in one search: Remotive, Remote OK, Arbeitnow, The Muse, Jobicy, Himalayas, plus Adzuna, USAJOBS and Google Jobs when their API keys are configured. Google Jobs (via JSearch) is how Indeed, LinkedIn and Glassdoor listings come in: through Google's index, not by scraping those sites.
- Results are normalised, **de-duplicated** across boards, filtered and ranked, with an honest per-source status strip showing which boards responded and which failed.
- **A match score on every job**, computed in your browser from your active resume: required-skill coverage, title similarity, nice-to-have coverage and general keyword overlap, with the matched and missing skills listed.
- **Filters** for keywords, location, remote-only, posted-within, employment type, source and sort order — plus **saved searches** you can re-run in one tap.
- **ZIP radius search.** Type a 5-digit ZIP in the location box and pick 5–100 miles: every posting that can be placed on a map shows its distance ("6.2 mi"), a **Nearest** sort appears, and **Include remote** keeps remote roles open to US applicants. Coordinates come from the Census Bureau's public-domain Gazetteer tables shipped in `server/geo/data/` (rebuild with `scripts/build-geo.ts`) — no geocoding API, no key. Most on-site US listings come from Adzuna, so connect it (below) for real local results; without it the keyless boards are mostly remote.
- Sanitised job descriptions (DOMPurify on the client, a first-pass strip on the server) and a direct apply link to the original posting.

### Tailor
- Analyse your resume **against a specific job description**: ATS report scoped to that posting, plus a required / nice-to-have **keyword gap** with one-click "add to skills".
- Optional **AI suggestions** (summary, headline and bullet rewrites) that you accept one at a time — into the current resume or a job-specific copy.
- Optional **cover letter generator** with copy and download.
- Without an API key the page is still fully useful: the gap analysis and ATS report are pure heuristics.

### Tracker
- **Kanban board** across Saved → Applied → Interviewing → Offer → Rejected → Archived, with drag-and-drop and a status dropdown fallback.
- Notes, follow-up dates, and a record of which resume you sent.
- Follow-ups that are overdue or due within a week surface on the dashboard.

### Local-first privacy
Resumes, tracked applications and saved searches live in this browser's `localStorage`. Match scoring and the ATS analysis run client-side. The server only aggregates public job boards and — if you configure a key — relays AI requests. Export a JSON backup any time; clear everything from **Settings → Your data**.

---

## Screenshots

_Screenshots go here: dashboard, resume builder with live preview, job finder with match scores, and the tracker board._

---

## Quick start

Requires Node 20 or newer.

```bash
npm install

# terminal 1 — API on :8787
npm run dev:server

# terminal 2 — Vite dev server on :5173 (proxies /api to :8787)
npm run dev
```

Open http://localhost:5173. The dashboard offers three ways to start: a filled-in sample resume, a blank one, or an import.

Production build and serve (one process serves the built SPA *and* the API):

```bash
npm run build     # → dist/
npm start         # serves dist/ + /api on $PORT (default 8787)
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Runs the vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` over the whole project |
| `npm run check` | typecheck + tests + build |
| `npm run smoke` | Hits the live job-board APIs and prints per-source counts |

---

## Environment variables

Copy `.env.example` to `.env` and fill in only what you want. **Every variable is optional** — with an empty file the app still builds resumes and searches six keyless job boards.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no | Port for the API / production server. Default `8787`; Render sets it automatically. |
| `ANTHROPIC_API_KEY` | no | Enables all AI features (bullet rewrites, summary, tailoring, cover letters, AI resume import). Without it those buttons show as "not configured". |
| `ANTHROPIC_MODEL` | no | Model override. Defaults to `claude-opus-5`. |
| `ADZUNA_APP_ID` | no | Adds Adzuna as a job source (broad US/UK/CA/AU/DE coverage). Free keys at [developer.adzuna.com](https://developer.adzuna.com/). |
| `ADZUNA_APP_KEY` | no | Second half of the Adzuna credential pair. |
| `ADZUNA_COUNTRY` | no | Default Adzuna country code (`us`, `gb`, `ca`, `au`, `de`, `fr`, …). Default `us`. |
| `USAJOBS_API_KEY` | no | Adds US federal vacancies. Free key at [developer.usajobs.gov](https://developer.usajobs.gov/). |
| `USAJOBS_USER_AGENT` | no | The contact email USAJOBS requires alongside the key. |
| `JSEARCH_API_KEY` | no | Adds Google Jobs (listings from Indeed, LinkedIn, Glassdoor, ZipRecruiter and company sites). Free tier of 200 searches/month at [openwebninja.com/api/jsearch](https://www.openwebninja.com/api/jsearch); paid plans from $25/month. |
| `JSEARCH_PROVIDER` | no | `openwebninja` (default) or `rapidapi`, depending on where the key came from. |
| `CORS_ORIGINS` | no | Comma-separated allowed origins. Only needed when the API is hosted apart from the UI. |

Keys are read **on the server only**. Launchpad never asks for a key in the browser and never stores one there.

---

## Deploy

### Render (blueprint)

`render.yaml` in the repo root describes the whole service, so you can point Render at the repo and hit **Apply**:

- Runtime: Node 22, plan `free`
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Env vars declared with `sync: false` (`ANTHROPIC_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT`, `JSEARCH_API_KEY`) — set them in the Render dashboard, or leave them blank to run without AI and without the three key-gated boards.

Render assigns `PORT`; the server reads it. Nothing else needs configuring.

### Any other Node host

The same single process serves the SPA and the API, so any host that can run Node works (Fly.io, Railway, a VPS behind nginx, Docker):

```bash
npm ci
npm run build
PORT=8080 npm start
```

Point your health check at `/api/health`, which returns the version, uptime, AI status and per-source configuration. If you serve the front end from a different origin than the API, set `CORS_ORIGINS` on the API.

---

## Architecture

```
shared/            Types and pure logic used by BOTH the browser and the server
  types.ts           Domain model (Resume, Job, TrackedJob, AtsReport, …)
  keywords.ts        Skill dictionary + keyword / requirement extraction
  match.ts           Resume ↔ job match scoring
  text.ts            stripHtml / normalize / tokenize helpers

src/               Vite + React 19 SPA
  main.tsx, App.tsx  Entry and route table
  pages/             Dashboard, ResumeBuilder, JobFinder, Tracker, Tailor, Settings, NotFound
  components/ui/     Design-system kit (Button, Card, Modal, Toast, ScoreRing, …)
  components/layout/ AppShell: sidebar, mobile tab bar, top bar, theme, toasts
  components/…       Feature components: resume-editor, resume-preview, jobs, tracker, tailor,
                     dashboard, settings
  lib/api.ts         Typed fetch client for /api
  lib/resume/        defaults, ats (scoring), parse-text (import), validate (zod), profile
  lib/export/        PDF (print), DOCX (docx), JSON
  stores/            zustand stores, persisted to localStorage
  styles/            tokens.css (design tokens), global.css, print.css
  hooks/             useTheme, useMediaQuery, useDebounce, useLocalStorage

server/            Express 5, run with tsx
  index.ts           App wiring, /api/health, static dist/ + SPA fallback
  jobs/sources/*     One adapter per board (timeout, abort, tolerant parsing)
  jobs/*             normalize, dedupe, filter, rank, cache (in-memory TTL + LRU)
  ai/*               Anthropic SDK client, prompts, JSON repair, rate limit
  routes/            /api/jobs, /api/ai

tests/             vitest — node by default, jsdom per-file for component tests
scripts/smoke.ts   Live job-source smoke check
```

Front-end path aliases: `@/` → `src/`, `@shared/` → `shared/`. Server code uses relative imports because it runs under `tsx` without the Vite aliases.

Data flow worth knowing: a search goes browser → `/api/jobs/search` → all enabled adapters in parallel (`Promise.allSettled`, per-source timeout, per-source cache) → normalise, dedupe, filter, rank, paginate → back to the browser, which then scores each job against your resume locally.

---

## Data and privacy

- Resumes, tracked applications and saved searches are stored in `localStorage` under the `launchpad.*` keys. Clearing your browser data deletes them; there is no server copy to restore from, so use **Settings → Export all resumes** for backups.
- The ATS report and every match score are computed in the browser. Your resume is never sent to the job boards.
- Job descriptions from third-party boards are untrusted HTML: the server strips scripts, styles, iframes, `on*` handlers and `javascript:` URLs, and the client sanitises again with DOMPurify before rendering.
- AI features are the only path that sends resume text off-device, and only for the action you trigger. They are off unless `ANTHROPIC_API_KEY` is set on the server.

---

## Job sources and attribution

Launchpad queries public, free APIs. Please respect each provider's terms when you deploy it:

| Source | Key needed | Notes |
| --- | --- | --- |
| [Remotive](https://remotive.com/) | no | Remote roles. Attribution appreciated. |
| [Remote OK](https://remoteok.com/) | no | **Requires a link back to Remote OK** for any listing you display — the app links every result to its original posting, and the first element of their API response is their legal notice. |
| [Arbeitnow](https://www.arbeitnow.com/) | no | European jobs, strong German coverage. |
| [The Muse](https://www.themuse.com/) | no | Use is governed by [The Muse API terms of service](https://www.themuse.com/developers/api/v2); keep the link to the original posting intact. |
| [Jobicy](https://jobicy.com/) | no | **Asks for credit to Jobicy** when their listings are shown. |
| [Himalayas](https://himalayas.app/) | no | Remote-first companies. |
| [Adzuna](https://developer.adzuna.com/) | yes (free) | Broad national coverage. |
| [USAJOBS](https://developer.usajobs.gov/) | yes (free) | US federal vacancies; requires a contact user-agent header. |
| [JSearch](https://www.openwebninja.com/api/jsearch) (Google Jobs) | yes (free tier) | Indeed, LinkedIn, Glassdoor and company-site listings via Google for Jobs. The app prefers the employer's own apply link and labels where each link leads ("via Indeed", "via Employer site"). Indeed and LinkedIn themselves are never scraped: both forbid automated access in their terms. |

Every job card and detail panel links to the original posting with `rel="noopener noreferrer"`, and the source is labelled on each result — that is how the link-back and credit requirements above are met. If you fork this and change the UI, keep those links.

---

## Testing

```bash
npm test          # vitest, whole suite
npm run typecheck # tsc --noEmit
npm run check     # typecheck + test + build
```

Tests live in `tests/` and run in Node by default; component tests opt into jsdom with `// @vitest-environment jsdom` as the first line. Job-source adapters are tested against recorded fixtures in `tests/fixtures/`, and the AI handlers against an injected mock client, so the suite never hits the network. `npm run smoke` is the deliberate exception — it calls the live boards and prints per-source counts.

---

## Roadmap

- **Accounts and sync** — optional, so a resume can follow you between devices without giving up the local-first default.
- **Email alerts** for saved searches, with the match score in the digest.
- **More boards** — Greenhouse and Lever company boards, Workable, and regional aggregators.
- **Chrome extension** to save a posting (and its description) from any careers page straight into the tracker.
- Interview prep notes attached to tracked applications, and salary data normalised across sources.

---

## Licence

No licence has been declared for this repository yet. Job data belongs to the boards it comes from; see the attribution table above.
