/**
 * Shared domain types — used by BOTH the browser app (src/) and the API server (server/).
 * Keep this file dependency-free (types only, plus tiny constants).
 *
 * Rules for everyone touching this file:
 *  - Do not add runtime imports.
 *  - Additive changes only once other modules depend on a shape; never rename a field casually.
 */

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export type ResumeId = string;

export interface ContactInfo {
  fullName: string;
  /** Professional headline shown under the name, e.g. "Senior Marketing Operations Manager". */
  headline: string;
  email: string;
  phone: string;
  /** Free-form, e.g. "Texarkana, TX" or "Remote (US)". */
  location: string;
  website: string;
  linkedin: string;
  github: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  title: string;
  location: string;
  /** "YYYY-MM" (month precision). Empty string when unknown. */
  startDate: string;
  /** "YYYY-MM"; ignored when `current` is true. */
  endDate: string;
  current: boolean;
  /** One achievement per bullet. Plain text, no leading bullet glyph. */
  bullets: string[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
  details: string[];
}

export interface SkillGroup {
  id: string;
  /** e.g. "Languages", "Marketing Tools", "Leadership". */
  name: string;
  skills: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  url: string;
  description: string;
  bullets: string[];
  technologies: string[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  /** "YYYY-MM" or free text. */
  date: string;
  url: string;
}

export interface CustomSectionItem {
  id: string;
  heading: string;
  subheading: string;
  date: string;
  bullets: string[];
}

export interface CustomSection {
  id: string;
  title: string;
  items: CustomSectionItem[];
}

/** Built-in sections plus `custom:<CustomSection.id>` for user-defined ones. */
export type SectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | `custom:${string}`;

export const BUILT_IN_SECTIONS: readonly SectionKey[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
] as const;

export type TemplateId = 'classic' | 'modern' | 'minimal' | 'executive' | 'sidebar';

export const TEMPLATE_IDS: readonly TemplateId[] = ['classic', 'modern', 'minimal', 'executive', 'sidebar'] as const;

export type PageSize = 'letter' | 'a4';
export type FontChoice = 'sans' | 'serif' | 'mixed';
export type Density = 'compact' | 'normal' | 'relaxed';

export interface ResumeStyle {
  template: TemplateId;
  /** Hex color like "#1f5eff". */
  accentColor: string;
  font: FontChoice;
  /** Base font size in points; 9–12. */
  fontSize: number;
  density: Density;
  pageSize: PageSize;
  /** Order in which sections render. Sections missing here render after the listed ones. */
  sectionOrder: SectionKey[];
  /** Hidden sections are kept in data but not rendered. */
  hiddenSections: SectionKey[];
}

export interface Resume {
  id: ResumeId;
  /** Internal label, e.g. "Marketing Ops — general". Not printed. */
  name: string;
  createdAt: string;
  updatedAt: string;
  contact: ContactInfo;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skillGroups: SkillGroup[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  customSections: CustomSection[];
  style: ResumeStyle;
  /** When this resume was tailored for a specific job (Job.id). */
  tailoredForJobId?: string;
}

/** Schema version stored alongside persisted resumes so migrations are possible later. */
export const RESUME_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type JobSource =
  | 'remotive'
  | 'remoteok'
  | 'arbeitnow'
  | 'themuse'
  | 'jobicy'
  | 'himalayas'
  | 'adzuna'
  | 'usajobs';

export const JOB_SOURCES: readonly JobSource[] = [
  'remotive',
  'remoteok',
  'arbeitnow',
  'themuse',
  'jobicy',
  'himalayas',
  'adzuna',
  'usajobs',
] as const;

export const JOB_SOURCE_LABELS: Record<JobSource, string> = {
  remotive: 'Remotive',
  remoteok: 'Remote OK',
  arbeitnow: 'Arbeitnow',
  themuse: 'The Muse',
  jobicy: 'Jobicy',
  himalayas: 'Himalayas',
  adzuna: 'Adzuna',
  usajobs: 'USAJOBS',
};

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary' | 'other';

export interface JobSalary {
  min?: number;
  max?: number;
  /** ISO 4217 like "USD". */
  currency?: string;
  period?: 'year' | 'month' | 'hour' | 'unknown';
  /** Pre-formatted string from the source when numbers are unavailable. */
  display?: string;
}

export interface Job {
  /** Globally unique: `${source}:${sourceId}`. */
  id: string;
  source: JobSource;
  sourceId: string;
  title: string;
  company: string;
  companyLogo?: string;
  /** Display string, e.g. "Austin, TX", "Remote — US", "Berlin, Germany". */
  location: string;
  remote: boolean;
  employmentType?: EmploymentType;
  category?: string;
  tags: string[];
  salary?: JobSalary;
  /**
   * Raw description HTML from the source (may be empty). NEVER render without sanitizing
   * (client uses DOMPurify). Server strips <script>/<style> and event handlers as a first pass.
   */
  descriptionHtml: string;
  /** Plain-text description used for matching and previews. */
  descriptionText: string;
  /** Link to the original posting / apply page. */
  url: string;
  /** ISO timestamp. */
  postedAt: string;
  /** ISO timestamp when our server fetched it. */
  fetchedAt: string;
}

export interface JobSearchQuery {
  /** Keywords; may be empty to browse. */
  q: string;
  location?: string;
  remoteOnly?: boolean;
  sources?: JobSource[];
  /** Only jobs posted within the last N days. */
  postedWithinDays?: number;
  employmentType?: EmploymentType;
  page?: number;
  pageSize?: number;
  sort?: 'relevance' | 'date';
}

export type SourceStatus = 'ok' | 'error' | 'timeout' | 'disabled' | 'skipped';

export interface SourceReport {
  source: JobSource;
  status: SourceStatus;
  /** Jobs contributed after normalization (before dedupe). */
  count: number;
  ms: number;
  error?: string;
}

export interface JobSearchResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  sources: SourceReport[];
  cached: boolean;
  /** ISO timestamp the underlying source data was fetched. */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Matching (resume <-> job)
// ---------------------------------------------------------------------------

export interface MatchResult {
  /** 0–100. */
  score: number;
  /** Skills/keywords found in both the resume and the job. */
  matchedSkills: string[];
  /** Skills/keywords the job asks for that the resume lacks. Most important first. */
  missingSkills: string[];
  /** 0–1 similarity between the resume headline/titles and the job title. */
  titleSimilarity: number;
  /** Short human-readable reasons, e.g. "7 of 9 required skills", "Title matches your headline". */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Application tracker
// ---------------------------------------------------------------------------

export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'archived';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'archived',
] as const;

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  archived: 'Archived',
};

export interface TrackedJob {
  /** Snapshot of the job at save time (sources expire postings). */
  job: Job;
  status: ApplicationStatus;
  notes: string;
  /** Resume used/tailored for this application. */
  resumeId?: ResumeId;
  savedAt: string;
  updatedAt: string;
  appliedAt?: string;
  /** Optional follow-up reminder date "YYYY-MM-DD". */
  followUpOn?: string;
}

// ---------------------------------------------------------------------------
// ATS analysis
// ---------------------------------------------------------------------------

export type AtsSeverity = 'critical' | 'warning' | 'tip';

export interface AtsIssue {
  id: string;
  severity: AtsSeverity;
  /** Which part of the resume: 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'formatting' | 'keywords' | 'general'. */
  area: string;
  message: string;
  /** Concrete suggestion to fix it. */
  fix: string;
  /** Points this issue costs (already reflected in the score). */
  impact: number;
}

export interface AtsCategoryScore {
  id: string;
  label: string;
  /** 0–100 for that category. */
  score: number;
  weight: number;
}

export interface AtsReport {
  /** 0–100 overall. */
  score: number;
  categories: AtsCategoryScore[];
  issues: AtsIssue[];
  /** Positive findings worth showing ("Every bullet starts with an action verb"). */
  strengths: string[];
  /** Only present when analyzed against a job description. */
  keywordCoverage?: {
    matched: string[];
    missing: string[];
    /** 0–100. */
    percent: number;
  };
  stats: {
    wordCount: number;
    bulletCount: number;
    quantifiedBullets: number;
    actionVerbBullets: number;
    estimatedPages: number;
  };
}

// ---------------------------------------------------------------------------
// AI (server) request/response shapes — all optional features
// ---------------------------------------------------------------------------

export interface AiStatus {
  enabled: boolean;
  model?: string;
  /** Reason when disabled, e.g. "ANTHROPIC_API_KEY not set". */
  reason?: string;
}

export interface AiImproveBulletRequest {
  bullet: string;
  /** Job title / company for context. */
  role?: string;
  /** Optional target job description to steer keywords. */
  jobText?: string;
  tone?: 'concise' | 'impact' | 'leadership' | 'technical';
}
export interface AiImproveBulletResponse {
  /** 2–4 alternative rewrites, best first. */
  suggestions: string[];
}

export interface AiSummaryRequest {
  resume: Resume;
  jobText?: string;
}
export interface AiSummaryResponse {
  summary: string;
  alternatives: string[];
}

export interface AiTailorRequest {
  resume: Resume;
  jobText: string;
  jobTitle?: string;
  company?: string;
}
export interface AiTailorSuggestion {
  /** 'summary' | 'bullet' | 'skill' | 'headline' */
  type: 'summary' | 'bullet' | 'skill' | 'headline';
  /** For bullets: experience item id + bullet index. */
  experienceId?: string;
  bulletIndex?: number;
  original?: string;
  suggested: string;
  reason: string;
}
export interface AiTailorResponse {
  suggestions: AiTailorSuggestion[];
  /** Keywords the job cares about that the resume should reflect. */
  keywordsToAdd: string[];
  /** Overall short note. */
  note: string;
}

export interface AiCoverLetterRequest {
  resume: Resume;
  jobText: string;
  jobTitle?: string;
  company?: string;
  tone?: 'professional' | 'warm' | 'direct';
  lengthWords?: number;
}
export interface AiCoverLetterResponse {
  letter: string;
}

export interface AiParseResumeRequest {
  /** Raw pasted resume text. */
  text: string;
}
export interface AiParseResumeResponse {
  /** Everything except id/name/createdAt/updatedAt/style, which the client fills in. */
  resume: Pick<
    Resume,
    'contact' | 'summary' | 'experience' | 'education' | 'skillGroups' | 'projects' | 'certifications' | 'customSections'
  >;
}

// ---------------------------------------------------------------------------
// Misc API
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface HealthResponse {
  ok: true;
  version: string;
  uptimeSeconds: number;
  ai: AiStatus;
  sources: { source: JobSource; enabled: boolean; needsKey: boolean }[];
}
