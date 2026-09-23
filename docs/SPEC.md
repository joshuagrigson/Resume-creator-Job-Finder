# Launchpad — Resume Builder + Job Finder — Build Spec

One web app that does two things better together than Indeed/LinkedIn + a separate resume tool:

1. **Build a great, ATS-ready resume** (multiple resumes, 5 templates, live preview, PDF/DOCX/JSON export, import from text).
2. **Find jobs and know instantly how well you match** (aggregated from many boards, scored against *your* resume, one-click tailor, application tracker).

Local-first: all user data lives in the browser (localStorage via zustand `persist`). The server only aggregates job boards and (optionally) proxies AI calls. No accounts in v1.

## Stack (already installed — do NOT add dependencies)

- Vite 7 + React 19 + TypeScript 5.9, `react-router-dom` 7, `zustand` 5, `zod` 4, `lucide-react` (icons), `@dnd-kit/*` (drag & drop), `dompurify`, `docx`.
- Server: Express 5 (`server/`), run with `tsx`. `@anthropic-ai/sdk` for AI.
- Tests: `vitest` 3 (`tests/**/*.test.ts(x)`), node env by default; add `// @vitest-environment jsdom` for DOM tests. `@testing-library/react` available.
- Plain CSS with design tokens (no Tailwind, no CSS-in-JS). Import CSS files from components (`import './x.css'`).

Path aliases (browser code only): `@/` → `src/`, `@shared/` → `shared/`. **Server code uses relative imports** (`../../shared/types`) because it runs under tsx without the Vite aliases.

Express 5 gotcha: route wildcards must be `/{*splat}`, not `*`. Prefer `app.use((req,res)=>…)` for fallbacks.

## Commands

```
npm run typecheck     # tsc --noEmit (whole project)
npm test              # vitest run
npm run dev           # Vite on :5173 (proxies /api → :8787)
npm run dev:server    # API on :8787
npm run build         # vite build → dist/
npm start             # serve dist/ + API on $PORT
```

While several builders work in the same tree, `typecheck` may show errors in files you don't own. Fix only errors in your files; report others.

## Repository layout & ownership

```
shared/types.ts                 all domain types (FROZEN — additive changes only, announce them)
shared/keywords.ts              skill dictionary + keyword extraction           [keywords-match]
shared/match.ts                 resume↔job match scoring                        [keywords-match]
shared/text.ts                  tokenize / strip HTML / normalize helpers       [keywords-match]

src/main.tsx, src/App.tsx       entry + routes (lead)
src/lib/id.ts                   uid(), nowIso() (lead)
src/lib/api.ts                  typed fetch client (lead)
src/lib/resume/defaults.ts      blank/sample resume factories (lead)
src/lib/resume/ats.ts           analyzeResume()                                 [ats-parse]
src/lib/resume/parse-text.ts    parseResumeText() heuristic import              [ats-parse]
src/lib/resume/validate.ts      zod schema + normalizeImportedResume()          [ats-parse]
src/lib/resume/profile.ts       resumeToPlainText(), resumeProfile()            [keywords-match]
src/lib/export/*                exportPdf/exportDocx/exportJson                 [resume-preview-export]
src/stores/*                    zustand stores (lead) — see API below

src/styles/tokens.css           design tokens                                   [ui-kit]
src/styles/global.css           reset + base + utilities + print base           [ui-kit]
src/components/ui/*             Button, Input, Textarea, Select, Card, Badge,
                                Modal, Tabs, Toast, EmptyState, Tooltip, …      [ui-kit]
src/components/layout/*         AppShell, Sidebar nav, TopBar, ThemeToggle      [ui-kit]
docs/UI-KIT.md                  component API doc for feature builders          [ui-kit]

src/components/resume-editor/*  form editor for every section                   [resume-editor]
src/pages/ResumeBuilder.tsx     editor + preview page                           [resume-editor]
src/components/resume-preview/* ResumePreview + templates/*                     [resume-preview-export]
src/components/jobs/*           search UI, cards, detail panel                  [jobs-ui]
src/pages/JobFinder.tsx                                                         [jobs-ui]
src/components/tracker/*, src/pages/Tracker.tsx                                 [tracker-tailor]
src/components/tailor/*, src/pages/Tailor.tsx                                   [tracker-tailor]
src/pages/Dashboard.tsx, src/pages/Settings.tsx, src/pages/NotFound.tsx         [dashboard-settings]

server/index.ts                 express app (lead)
server/jobs/**                  sources, normalize, dedupe, cache, search       [server-jobs]
server/routes/jobs.ts                                                           [server-jobs]
server/ai/**, server/routes/ai.ts                                               [server-ai]
scripts/smoke.ts                live API smoke script                           [server-jobs]
tests/<area>.*.test.ts          each owner writes tests for their area
```

## Data model

See `shared/types.ts` (source of truth). Key points:

- `Resume.style.sectionOrder` controls rendering order; `hiddenSections` hides without deleting. Custom sections use key `custom:<id>`.
- Dates are `"YYYY-MM"` strings; `current: true` means "Present".
- `Job.id = "${source}:${sourceId}"`. `descriptionHtml` is untrusted; **always** render through DOMPurify (`DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`) and never `dangerouslySetInnerHTML` raw.
- Match scoring runs **client-side** (privacy: the resume never leaves the browser unless the user uses an AI feature).

## Store API (src/stores — already implemented)

```ts
// resumeStore
useResumeStore(s => s.resumes / activeResumeId / createResume / addResume / duplicateResume /
                    deleteResume / renameResume / setActiveResume / updateResume / moveSection /
                    setSectionOrder / toggleSectionHidden / reset)
useActiveResume(): Resume | undefined
useResumeList(): Resume[]                // newest first
updateResume(id, patch | (r) => Resume)  // bumps updatedAt

// jobStore
useJobStore(s => s.query / results / loading / error / selectedJobId / jobsById /
                 setQuery / search(patch?) / selectJob /
                 tracked / savedSearches / trackJob(job, status?, resumeId?) / untrackJob /
                 setStatus / setNotes / setFollowUp / setTrackedResume / isTracked /
                 saveSearch / deleteSavedSearch / reset)
useTrackedJobs(): TrackedJob[]

// settingsStore
useSettingsStore(s => s.theme / onboarded / health / ai / healthError / setTheme / setOnboarded / refreshHealth)
resolveTheme(mode): 'light' | 'dark'
```

`api` (src/lib/api.ts): `api.health()`, `api.searchJobs(query)`, `api.getJob(id)`, `api.ai.status() / improveBullet() / summary() / tailor() / coverLetter() / parseResume()`. All throw `ApiClientError { status, code }`.

## Module contracts (what each owner MUST export)

### shared/keywords.ts + shared/match.ts + shared/text.ts + src/lib/resume/profile.ts  [keywords-match]

```ts
// shared/text.ts
export function stripHtml(html: string): string;            // → plain text, entities decoded, whitespace collapsed
export function normalizeText(s: string): string;           // lowercase, unicode-normalize, collapse whitespace
export function tokenize(s: string): string[];              // words, keeps c++, c#, .net, node.js style tokens
export const STOPWORDS: ReadonlySet<string>;

// shared/keywords.ts
export interface SkillEntry { canonical: string; aliases: string[]; category: 'language'|'framework'|'tool'|'cloud'|'data'|'design'|'marketing'|'sales'|'ops'|'soft'|'finance'|'healthcare'|'trades'|'other'; }
export const SKILL_DICTIONARY: SkillEntry[];               // ≥ 400 entries across white- and blue-collar fields, incl. call-center/marketing ops (HubSpot, Salesforce, Convoso, Twilio, GoHighLevel, dialer, lead scoring …)
export function extractSkills(text: string): string[];     // canonical names found in text (multi-word aware, alias-aware), deduped, in order of first appearance
export function extractKeywords(text: string, limit?: number): { term: string; count: number }[]; // frequent non-stopword terms/bigrams that look like requirements (fallback when dictionary misses)
export function extractRequirements(jobText: string): { required: string[]; niceToHave: string[] }; // skills split by "required/must" vs "nice to have/preferred/bonus" context when detectable; otherwise all → required

// shared/match.ts
export interface ResumeProfile { skills: string[]; titles: string[]; headline: string; text: string; yearsExperience: number; }
export function scoreJobMatch(profile: ResumeProfile, job: Pick<Job,'title'|'descriptionText'|'tags'|'category'>): MatchResult;
export function matchLabel(score: number): { label: 'Excellent'|'Strong'|'Good'|'Fair'|'Low'; tone: 'success'|'info'|'warning'|'danger' };

// src/lib/resume/profile.ts
export function resumeToPlainText(resume: Resume): string;
export function resumeProfile(resume: Resume): ResumeProfile;  // skills = skillGroups + skills extracted from bullets/summary
```

Scoring guidance: weighted blend — required-skill coverage (≈55%), title/headline similarity (≈20%), nice-to-have coverage (≈10%), general keyword overlap (≈15%). Empty job description → rely on title + tags. Missing skills ordered required-first. Must be deterministic and fast (thousands of calls per search).

### src/lib/resume/ats.ts, parse-text.ts, validate.ts  [ats-parse]

```ts
export function analyzeResume(resume: Resume, jobText?: string): AtsReport;   // uses shared/keywords for coverage
export function parseResumeText(text: string): Partial<Resume>;                // heuristic; sections by headings; experience by date-range lines; skills by commas/bullets
export const ResumeSchema: z.ZodType<Resume>;                                   // zod v4
export function normalizeImportedResume(input: unknown): { resume: Resume; warnings: string[] } | { error: string }; // accepts our JSON export, JSON Resume (jsonresume.org) shape, and partial objects; fills defaults, new ids
```

ATS categories (weights): Contact & headers 15, Summary 10, Experience quality 30 (action verbs, quantified, 3–6 bullets/role, recency), Skills 15, Education/certs 5, Formatting/length 10 (est. pages, bullet length 8–30 words, no first-person, no tables/graphics — N/A here), Keywords vs job 15 (only when jobText given; otherwise weight redistributed). Every issue has a concrete `fix`.

### src/components/resume-preview + src/lib/export  [resume-preview-export]

```tsx
export function ResumePreview(props: { resume: Resume; scale?: number; className?: string; id?: string }): JSX.Element;
// Renders a real page-sized sheet (8.5×11in or 210×297mm) using the resume.style; must look right in print (@page + print CSS) and on screen scaled.
export const TEMPLATES: { id: TemplateId; name: string; description: string }[];
// src/lib/export/index.ts
export function exportPdf(resume: Resume): Promise<void>;   // print-based: renders the preview full-size into a hidden iframe or a print stylesheet and calls window.print(); document title = "<Name> Resume"
export function exportDocx(resume: Resume): Promise<void>;  // `docx` package, ATS-friendly single-column, mirrors section order; downloads "<Name> Resume.docx"
export function exportJson(resume: Resume): void;           // downloads "<Name> Resume.json" (our schema, includes schemaVersion)
export function resumeFileName(resume: Resume, ext: string): string;
```

Templates: `classic` (serif, centered header, rules), `modern` (accent bar, bold sans), `minimal` (lots of whitespace, thin type), `executive` (two-line header, small caps section titles), `sidebar` (left accent column with contact + skills; main column experience — still text-based so ATS can read it). All honor accentColor, font, fontSize, density, pageSize, sectionOrder, hiddenSections.

### src/components/resume-editor + src/pages/ResumeBuilder.tsx  [resume-editor]

- Page layout: left editor (scrollable), right sticky live preview (`ResumePreview` scaled to fit), top bar: resume switcher (dropdown of `useResumeList()`), new/duplicate/rename/delete, template & style popover, Export menu (PDF/DOCX/JSON), Import (JSON file or paste text → `parseResumeText` / AI parse when enabled).
- Editor: one collapsible panel per section with drag-to-reorder sections (dnd-kit) plus up/down buttons; per-item reorder; add/remove; bullet editor with Enter-to-add, backspace-on-empty-to-remove; "Improve with AI" button on bullets when `useSettingsStore().ai?.enabled` (calls `api.ai.improveBullet`, shows suggestions to pick). Autosave is automatic (store). Show a small "Saved" indicator.
- Live ATS score chip in the top bar (uses `analyzeResume`), click → opens the ATS panel (issues list with "fix" hints).
- Mobile: editor and preview become tabs.

### src/components/jobs + src/pages/JobFinder.tsx  [jobs-ui]

- Search bar (keywords, location, remote toggle, posted-within, sources multi-select, sort by relevance/date/match), submit on Enter. State via `useJobStore`.
- Results list: JobCard with title, company, location/remote, posted ago, salary if any, source badge, **MatchBadge** (score + label from `scoreJobMatch(resumeProfile(activeResume), job)`), save/track buttons. Sorting by match is client-side.
- Detail panel (right side on desktop, full-screen sheet on mobile): sanitized description, matched/missing skills chips, "Tailor resume for this job" (→ `/tailor/:jobId`), "Apply on <source>" (external link, `rel="noopener noreferrer"`), track status dropdown.
- Source status strip after each search (which boards responded, errors) and "Save this search". Loading skeletons, empty states, error state with retry. Pagination.
- If no resume exists: friendly prompt to create one (match scores hidden until then).

### src/components/tracker + src/pages/Tracker.tsx, src/components/tailor + src/pages/Tailor.tsx  [tracker-tailor]

- Tracker: kanban columns for `APPLICATION_STATUSES` (archived collapsed), drag cards between columns (dnd-kit) + status dropdown fallback, notes editor, follow-up date, resume used, quick link to posting and to tailor. List view toggle. Counts in column headers.
- Tailor page: pick a tracked/recent job or paste a job description; shows ATS report vs that JD (`analyzeResume(resume, jobText)`), keyword gap (required/missing), "Add to skills" one-click, AI section (when enabled): tailor suggestions with accept-per-suggestion that writes into the resume (optionally as a duplicated, job-specific copy — offer "Create tailored copy"), cover letter generator with copy/download .txt. Without AI: still fully useful via heuristics.

### src/pages/Dashboard.tsx, Settings.tsx, NotFound.tsx + README.md  [dashboard-settings]

- Dashboard: first-run welcome (create sample / blank / import), active resume card with ATS score ring, quick job search box, tracker pipeline counts, upcoming follow-ups, "best matches" from the last search, tips.
- Settings: theme, AI status (from `/api/health`), job sources status/keys explanation, data export (all resumes JSON) / import / clear-all (with confirm), about.
- README: what it is, features, screenshots placeholder, run locally, deploy to Render (render.yaml), env vars, architecture, roadmap.

### server/jobs/**  [server-jobs]

```ts
export async function searchJobs(query: JobSearchQuery): Promise<JobSearchResponse>;
export async function getJob(id: string): Promise<Job | null>;          // from cache
export function listSourceConfig(): { source: JobSource; enabled: boolean; needsKey: boolean }[];
```

- Sources (all free, keyless unless noted): Remotive (`https://remotive.com/api/remote-jobs?search=&limit=`), Remote OK (`https://remoteok.com/api`, first element is legal notice), Arbeitnow (`https://www.arbeitnow.com/api/job-board-api?page=`), The Muse (`https://www.themuse.com/api/public/jobs?page=&category=&location=`), Jobicy (`https://jobicy.com/api/v2/remote-jobs?count=&tag=&geo=`), Himalayas (`https://himalayas.app/jobs/api?limit=&offset=`), Adzuna (needs ADZUNA_APP_ID/KEY; `https://api.adzuna.com/v1/api/jobs/{country}/search/{page}?app_id&app_key&what&where&results_per_page&max_days_old`), USAJOBS (needs USAJOBS_API_KEY + USAJOBS_USER_AGENT headers; `https://data.usajobs.gov/api/search?Keyword=&LocationName=`).
- Each adapter: `fetchJobs(query, ctx) → Job[]`, with a per-source timeout (8s), `AbortController`, user-agent header, robust parsing (never throw on a single bad item), HTML→text via `stripHtml`, salary normalization, posted date parsing, `remote` detection, tags lowercased.
- Search service: run enabled sources in parallel (`Promise.allSettled`), per-source cache (in-memory TTL ~15 min keyed by source+normalized query), normalize, **dedupe** (same normalized title+company → keep newest / most complete), filter (keywords across title/description/tags with all terms required unless quoted; location substring match with "remote" special-casing; postedWithinDays; employmentType), rank (relevance = title hits > tag hits > description hits, recency tie-break), paginate. Return `SourceReport[]` honestly (status, count, ms, error message without secrets).
- Server-side first-pass sanitize of `descriptionHtml`: drop `<script>`, `<style>`, `<iframe>`, `on*=` attributes, `javascript:` URLs. Client still DOMPurifies.
- Keep the last N (≈5000) jobs in an LRU map so `getJob(id)` works for detail links/deep links.
- Never let one source failure fail the request. Total request budget ≈ 12s.
- Tests with recorded fixtures per source (small JSON files under `tests/fixtures/`), plus dedupe/filter/rank unit tests. `scripts/smoke.ts` hits the live APIs and prints counts (network permitting).

### server/ai/**  [server-ai]

- Read `/tmp/claude-0/bundled-skills/2.1.269/7920e2da3465bcc0724873c8839f3943/claude-api/typescript/claude-api/README.md` and `tool-use.md` (structured outputs section) BEFORE writing SDK code. Use `@anthropic-ai/sdk`, model from `ANTHROPIC_MODEL` env or default `claude-opus-5`, `max_tokens` ≈ 4000–8000, adaptive thinking omitted/`{type:'adaptive'}`, `output_config.effort: 'medium'` for short rewrites. Structured JSON via `output_config.format` (JSON schema) or a strict "respond with JSON only" prompt + robust parse (strip code fences) — choose what the SDK README documents.
- Endpoints (all POST JSON, validated with zod, 503 `ai_disabled` when no key, 400 on bad input, 502 `ai_upstream` on API errors, 429 passthrough):
  - `/api/ai/status` GET → `AiStatus`
  - `/api/ai/improve-bullet` → `AiImproveBulletResponse` (3 rewrites: quantified, action-verb-first, ≤ 30 words, no fabricated numbers — say "[X]%" placeholders when a number is needed but unknown)
  - `/api/ai/summary` → `AiSummaryResponse`
  - `/api/ai/tailor` → `AiTailorResponse` (never invent experience; only rephrase/reorder/emphasize; keywordsToAdd only if plausibly true given the resume)
  - `/api/ai/cover-letter` → `AiCoverLetterResponse`
  - `/api/ai/parse-resume` → `AiParseResumeResponse` (strict JSON matching the Resume subset; generate ids server-side with crypto.randomUUID)
  - `/api/ai/polish` → `AiPolishResponse` (the smart prompt under a field: rewords only, never adds a fact — a rewrite with a number he never gave is discarded server-side; 0–2 follow-up questions for missing facts; see docs/DESIGN-SMART-PROMPT.md)
- A simple in-memory rate limit (e.g., 30 req / 10 min per IP) and 20 KB input caps. Log nothing sensitive.
- Tests: mock the Anthropic client (inject via a factory `createAiClient()` that tests override) — validate prompt assembly, JSON parsing/repair, error mapping, disabled mode.

## UI quality bar ("amazing", not "works")

- A coherent design system: tokens for color (light + dark), spacing scale, radius, shadows, typography (system font stack; `Inter` if present). Accent = `#1f5eff` family; success/warning/danger. Focus rings visible. Reduced-motion respected.
- Responsive from 360px to 1600px. Sidebar nav on desktop, bottom nav on mobile.
- Keyboard: every action reachable; labels on inputs; `aria-*` on custom widgets; no color-only meaning.
- Empty, loading, and error states everywhere data loads.
- Copy is short and human. No lorem ipsum. No console errors.

## Definition of done per module

1. `npm run typecheck` clean for your files.
2. Tests for your logic pass (`npx vitest run tests/<yours>`).
3. No new dependencies. No git commands. No edits to files you don't own (if you need an interface change, add it in an additive way and say so in your final report).
4. Final report: files created, public API, anything deviating from this spec, known gaps.
