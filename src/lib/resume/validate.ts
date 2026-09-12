/**
 * Import validation for resumes.
 *
 * `ResumeSchema` is a deliberately forgiving zod v4 schema: every field falls back to a
 * sane value instead of throwing, and unknown keys are stripped. `normalizeImportedResume`
 * builds on it and accepts everything a user is likely to drop on the app:
 *
 *  - our own export — `{ schemaVersion, resume }`
 *  - an all-resumes export — `{ resumes: [...] }` or a bare array
 *  - a bare `Resume` object, or any partial subset of one
 *  - a JSON Resume document (jsonresume.org: `basics` / `work` / `education` / `skills` /
 *    `projects` / `certificates` / `awards` / `volunteer` / `publications`)
 *  - the same, as a JSON string
 *
 * Ids are regenerated when missing or duplicated, dates are coerced to `"YYYY-MM"`, style
 * values are range-checked, and anything dropped along the way is reported in `warnings`.
 */

import { z } from 'zod';
import type {
  CertificationItem,
  CustomSection,
  CustomSectionItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  Resume,
  SectionKey,
  SkillGroup,
} from '@shared/types';
import { BUILT_IN_SECTIONS, RESUME_SCHEMA_VERSION, TEMPLATE_IDS } from '@shared/types';
import { createBlankResume, DEFAULT_STYLE } from '@/lib/resume/defaults';
import { nowIso, uid } from '@/lib/id';
import { toYearMonth } from '@/lib/resume/parse-text';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const str = (fallback = ''): z.ZodCatch<z.ZodString> => z.string().catch(fallback);
const strArray = z.array(z.string()).catch([]);
const bool = z.boolean().catch(false);

const SectionKeySchema = z.custom<SectionKey>((value) => typeof value === 'string' && value.length > 0);

const ExperienceSchema = z.object({
  id: str(),
  company: str(),
  title: str(),
  location: str(),
  startDate: str(),
  endDate: str(),
  current: bool,
  bullets: strArray,
});

const EducationSchema = z.object({
  id: str(),
  school: str(),
  degree: str(),
  field: str(),
  location: str(),
  startDate: str(),
  endDate: str(),
  gpa: str(),
  details: strArray,
});

const SkillGroupSchema = z.object({
  id: str(),
  name: str(),
  skills: strArray,
});

const ProjectSchema = z.object({
  id: str(),
  name: str(),
  url: str(),
  description: str(),
  bullets: strArray,
  technologies: strArray,
});

const CertificationSchema = z.object({
  id: str(),
  name: str(),
  issuer: str(),
  date: str(),
  url: str(),
});

const CustomSectionItemSchema = z.object({
  id: str(),
  heading: str(),
  subheading: str(),
  date: str(),
  bullets: strArray,
});

const CustomSectionSchema = z.object({
  id: str(),
  title: str(),
  items: z.array(CustomSectionItemSchema).catch([]),
});

const ContactSchema = z.object({
  fullName: str(),
  headline: str(),
  email: str(),
  phone: str(),
  location: str(),
  website: str(),
  linkedin: str(),
  github: str(),
});

const StyleSchema = z.object({
  template: z.enum(['classic', 'modern', 'minimal', 'executive', 'sidebar']).catch(DEFAULT_STYLE.template),
  accentColor: str(DEFAULT_STYLE.accentColor),
  font: z.enum(['sans', 'serif', 'mixed']).catch(DEFAULT_STYLE.font),
  fontSize: z.number().catch(DEFAULT_STYLE.fontSize),
  density: z.enum(['compact', 'normal', 'relaxed']).catch(DEFAULT_STYLE.density),
  pageSize: z.enum(['letter', 'a4']).catch(DEFAULT_STYLE.pageSize),
  sectionOrder: z.array(SectionKeySchema).catch([...DEFAULT_STYLE.sectionOrder]),
  hiddenSections: z.array(SectionKeySchema).catch([]),
});

const ResumeObjectSchema = z.object({
  id: str(),
  name: str(),
  createdAt: str(),
  updatedAt: str(),
  contact: ContactSchema.catch(() => ({
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    linkedin: '',
    github: '',
  })),
  summary: str(),
  experience: z.array(ExperienceSchema).catch([]),
  education: z.array(EducationSchema).catch([]),
  skillGroups: z.array(SkillGroupSchema).catch([]),
  projects: z.array(ProjectSchema).catch([]),
  certifications: z.array(CertificationSchema).catch([]),
  customSections: z.array(CustomSectionSchema).catch([]),
  style: StyleSchema.catch(() => ({
    ...DEFAULT_STYLE,
    sectionOrder: [...DEFAULT_STYLE.sectionOrder],
    hiddenSections: [],
  })),
  tailoredForJobId: z.string().optional().catch(undefined),
});

/** Loose zod schema for a `Resume`: unknown keys are stripped, bad values fall back. */
export const ResumeSchema: z.ZodType<Resume> = ResumeObjectSchema;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;
const BUILT_IN = new Set<string>(BUILT_IN_SECTIONS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (isPlainObject(item) ? text(item.name ?? item.title ?? item.keyword) : text(item))).filter(Boolean);
  }
  const single = text(value);
  return single ? [single] : [];
}

function objectList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

class DateFixer {
  unreadable = 0;
  private readonly samples: string[] = [];

  fix(raw: unknown, prefer: 'start' | 'end' = 'start'): string {
    const value = text(raw);
    if (!value) return '';
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
    const normalized = toYearMonth(value, prefer);
    if (!normalized) {
      this.unreadable += 1;
      if (this.samples.length < 3) this.samples.push(value);
      return '';
    }
    return normalized;
  }

  /**
   * `CertificationItem.date` is documented as "YYYY-MM" *or* free text, so an unreadable
   * value is kept verbatim instead of being discarded, and a year stays a year.
   */
  soften(raw: unknown): string {
    const value = text(raw);
    if (!value) return '';
    if (/^\d{4}$/.test(value)) return value;
    const normalized = toYearMonth(value, 'end');
    return normalized || value;
  }

  warning(): string | null {
    if (this.unreadable === 0) return null;
    return `Could not read ${this.unreadable} date${this.unreadable === 1 ? '' : 's'} (${this.samples.join(', ')}) — left blank.`;
  }
}

/** Assign a fresh id when missing, malformed or already used. */
function freshId(current: string, prefix: string, used: Set<string>): string {
  const value = (current ?? '').trim();
  if (value && !used.has(value)) {
    used.add(value);
    return value;
  }
  let next = uid(prefix);
  while (used.has(next)) next = uid(prefix);
  used.add(next);
  return next;
}

// ---------------------------------------------------------------------------
// JSON Resume mapping
// ---------------------------------------------------------------------------

function looksLikeJsonResume(data: Record<string, unknown>): boolean {
  if (isPlainObject(data.basics)) return true;
  if (Array.isArray(data.work) && !Array.isArray(data.experience)) return true;
  const meta = isPlainObject(data.meta) ? text(data.meta.canonical) : '';
  return meta.toLowerCase().includes('jsonresume');
}

const JSON_RESUME_KNOWN = new Set([
  '$schema', 'meta', 'basics', 'work', 'volunteer', 'education', 'awards', 'certificates',
  'certifications', 'publications', 'skills', 'languages', 'interests', 'references', 'projects',
]);

function fromJsonResume(data: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
  const basics = isPlainObject(data.basics) ? data.basics : {};
  const profiles = objectList(basics.profiles);
  const findProfile = (network: string): string => {
    const hit = profiles.find((profile) => text(profile.network).toLowerCase() === network);
    return hit ? text(hit.url) || text(hit.username) : '';
  };

  const locationObj = isPlainObject(basics.location) ? basics.location : {};
  const city = text(locationObj.city);
  const region = text(locationObj.region) || text(locationObj.countryCode);
  const location = [city, region].filter(Boolean).join(', ');

  const experience = objectList(data.work).map((item) => ({
    id: text(item.id),
    company: text(item.name) || text(item.company) || text(item.organization),
    title: text(item.position),
    location: text(item.location),
    startDate: text(item.startDate),
    endDate: text(item.endDate),
    current: !text(item.endDate),
    bullets: [text(item.summary), ...textList(item.highlights)].filter(Boolean),
  }));

  const education = objectList(data.education).map((item) => ({
    id: text(item.id),
    school: text(item.institution) || text(item.school),
    degree: text(item.studyType),
    field: text(item.area),
    location: text(item.location),
    startDate: text(item.startDate),
    endDate: text(item.endDate),
    gpa: text(item.score),
    details: textList(item.courses),
  }));

  const rawSkills = objectList(data.skills);
  const skillGroups: Record<string, unknown>[] = [];
  const flatSkills: string[] = [];
  for (const skill of rawSkills) {
    const keywords = textList(skill.keywords);
    const name = text(skill.name);
    if (keywords.length > 0) skillGroups.push({ id: '', name: name || 'Skills', skills: keywords });
    else if (name) flatSkills.push(name);
  }
  if (flatSkills.length > 0) skillGroups.push({ id: '', name: 'Skills', skills: flatSkills });

  const projects = objectList(data.projects).map((item) => ({
    id: text(item.id),
    name: text(item.name),
    url: text(item.url),
    description: text(item.description),
    bullets: textList(item.highlights),
    technologies: textList(item.keywords),
  }));

  const certifications = [...objectList(data.certificates), ...objectList(data.certifications)].map((item) => ({
    id: text(item.id),
    name: text(item.name),
    issuer: text(item.issuer),
    date: text(item.date),
    url: text(item.url),
  }));

  const customSections: Record<string, unknown>[] = [];
  const awards = objectList(data.awards);
  if (awards.length > 0) {
    customSections.push({
      id: '',
      title: 'Awards',
      items: awards.map((award) => ({
        id: '',
        heading: text(award.title),
        subheading: text(award.awarder),
        date: text(award.date),
        bullets: [text(award.summary)].filter(Boolean),
      })),
    });
  }
  const volunteer = objectList(data.volunteer);
  if (volunteer.length > 0) {
    customSections.push({
      id: '',
      title: 'Volunteer',
      items: volunteer.map((item) => ({
        id: '',
        heading: text(item.position),
        subheading: text(item.organization),
        date: [text(item.startDate), text(item.endDate)].filter(Boolean).join(' – '),
        bullets: [text(item.summary), ...textList(item.highlights)].filter(Boolean),
      })),
    });
  }
  const publications = objectList(data.publications);
  if (publications.length > 0) {
    customSections.push({
      id: '',
      title: 'Publications',
      items: publications.map((item) => ({
        id: '',
        heading: text(item.name),
        subheading: text(item.publisher),
        date: text(item.releaseDate),
        bullets: [text(item.summary)].filter(Boolean),
      })),
    });
  }

  for (const key of ['languages', 'interests', 'references'] as const) {
    const dropped = Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0;
    if (dropped > 0) warnings.push(`Dropped ${dropped} JSON Resume "${key}" ${dropped === 1 ? 'entry' : 'entries'}.`);
  }
  const unknownKeys = Object.keys(data).filter((key) => !JSON_RESUME_KNOWN.has(key));
  if (unknownKeys.length > 0) warnings.push(`Ignored unrecognized ${unknownKeys.length === 1 ? 'field' : 'fields'}: ${unknownKeys.slice(0, 5).join(', ')}.`);

  warnings.push('Imported from JSON Resume format.');

  return {
    name: text(basics.name) ? `${text(basics.name)} — imported` : 'Imported resume',
    contact: {
      fullName: text(basics.name),
      headline: text(basics.label),
      email: text(basics.email),
      phone: text(basics.phone),
      location,
      website: text(basics.url) || text(basics.website),
      linkedin: findProfile('linkedin'),
      github: findProfile('github'),
    },
    summary: text(basics.summary),
    experience,
    education,
    skillGroups,
    projects,
    certifications,
    customSections,
  };
}

// ---------------------------------------------------------------------------
// normalizeImportedResume
// ---------------------------------------------------------------------------

export interface NormalizedResume {
  resume: Resume;
  warnings: string[];
}

function hasAnyContent(resume: Resume): boolean {
  const contact = Object.values(resume.contact).some((value) => value.trim().length > 0);
  const experience = resume.experience.some(
    (item) => item.company || item.title || item.bullets.some((b) => b.trim()),
  );
  const education = resume.education.some((item) => item.school || item.degree || item.field);
  const skills = resume.skillGroups.some((group) => group.skills.length > 0);
  const projects = resume.projects.some((item) => item.name);
  const certifications = resume.certifications.some((item) => item.name);
  const custom = resume.customSections.some((section) => section.items.length > 0);
  return Boolean(
    contact || resume.summary.trim() || experience || education || skills || projects || certifications || custom,
  );
}

/**
 * Turn anything resume-shaped into a valid `Resume`, or explain why it could not.
 *
 * The returned resume always has a brand-new `id` so importing the same file twice never
 * overwrites an existing resume in the store.
 */
export function normalizeImportedResume(input: unknown): NormalizedResume | { error: string } {
  const warnings: string[] = [];
  let data: unknown = input;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return { error: 'That file is empty.' };
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { error: 'That file is not valid JSON. Use “Import text” to paste a resume instead.' };
    }
  }

  if (Array.isArray(data)) {
    const first = data.find(isPlainObject);
    if (!first) return { error: 'That file does not contain a resume.' };
    if (data.length > 1) warnings.push(`File contained ${data.length} resumes — imported the first one.`);
    data = first;
  }

  if (!isPlainObject(data)) return { error: 'That file does not contain a resume object.' };

  // Our own export envelope, or an all-resumes export.
  if (Array.isArray(data.resumes)) {
    const list = objectList(data.resumes);
    if (list.length === 0) return { error: 'That export contains no resumes.' };
    if (list.length > 1) warnings.push(`File contained ${list.length} resumes — imported the first one.`);
    data = list[0];
  } else if (isPlainObject(data.resume)) {
    const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : null;
    if (version !== null && version > RESUME_SCHEMA_VERSION) {
      warnings.push(`File was written by a newer version (schema ${version}); unknown fields were ignored.`);
    }
    data = data.resume;
  }

  if (!isPlainObject(data)) return { error: 'That file does not contain a resume object.' };

  const payload: Record<string, unknown> = looksLikeJsonResume(data) ? fromJsonResume(data, warnings) : data;

  // The schema silently repairs bad enum values, so note the original before parsing.
  const rawStyle = isPlainObject(payload.style) ? payload.style : {};
  const rawTemplate = text(rawStyle.template);

  let parsed: Resume;
  try {
    parsed = ResumeObjectSchema.parse(payload);
  } catch {
    return { error: 'That file could not be read as a resume.' };
  }

  const blank = createBlankResume();
  const dates = new DateFixer();
  const usedIds = new Set<string>();

  const experience: ExperienceItem[] = parsed.experience.map((item) => {
    const startDate = dates.fix(item.startDate, 'start');
    const endDate = dates.fix(item.endDate, 'end');
    return {
      id: freshId(item.id, 'exp', usedIds),
      company: item.company.trim(),
      title: item.title.trim(),
      location: item.location.trim(),
      startDate,
      endDate: item.current ? '' : endDate,
      current: item.current || (!endDate && Boolean(startDate) && /present|current|now/i.test(item.endDate)),
      bullets: item.bullets.map((b) => b.trim()).filter(Boolean),
    };
  });

  const education: EducationItem[] = parsed.education.map((item) => ({
    id: freshId(item.id, 'edu', usedIds),
    school: item.school.trim(),
    degree: item.degree.trim(),
    field: item.field.trim(),
    location: item.location.trim(),
    startDate: dates.fix(item.startDate, 'start'),
    endDate: dates.fix(item.endDate, 'end'),
    gpa: item.gpa.trim(),
    details: item.details.map((d) => d.trim()).filter(Boolean),
  }));

  const skillGroups: SkillGroup[] = parsed.skillGroups.map((group) => ({
    id: freshId(group.id, 'skl', usedIds),
    name: group.name.trim(),
    skills: group.skills.map((s) => s.trim()).filter(Boolean),
  }));

  const projects: ProjectItem[] = parsed.projects.map((item) => ({
    id: freshId(item.id, 'prj', usedIds),
    name: item.name.trim(),
    url: item.url.trim(),
    description: item.description.trim(),
    bullets: item.bullets.map((b) => b.trim()).filter(Boolean),
    technologies: item.technologies.map((t) => t.trim()).filter(Boolean),
  }));

  const certifications: CertificationItem[] = parsed.certifications.map((item) => ({
    id: freshId(item.id, 'crt', usedIds),
    name: item.name.trim(),
    issuer: item.issuer.trim(),
    date: dates.soften(item.date),
    url: item.url.trim(),
  }));

  // Custom section ids appear in sectionOrder as `custom:<id>`, so remaps must follow.
  const sectionIdRemap = new Map<string, string>();
  const customSections: CustomSection[] = parsed.customSections.map((section) => {
    const previous = section.id.trim();
    const id = freshId(previous, 'sec', usedIds);
    if (previous && previous !== id) sectionIdRemap.set(previous, id);
    const items: CustomSectionItem[] = section.items.map((item) => ({
      id: freshId(item.id, 'itm', usedIds),
      heading: item.heading.trim(),
      subheading: item.subheading.trim(),
      date: item.date.trim(),
      bullets: item.bullets.map((b) => b.trim()).filter(Boolean),
    }));
    return { id, title: section.title.trim() || 'Additional', items };
  });

  const validSectionKeys = new Set<string>([
    ...BUILT_IN,
    ...customSections.map((section) => `custom:${section.id}`),
  ]);
  const mapSectionKey = (key: SectionKey): SectionKey => {
    if (!key.startsWith('custom:')) return key;
    const remapped = sectionIdRemap.get(key.slice('custom:'.length));
    return remapped ? (`custom:${remapped}` as SectionKey) : key;
  };
  const cleanSectionKeys = (keys: SectionKey[]): SectionKey[] => {
    const seen = new Set<string>();
    const out: SectionKey[] = [];
    for (const raw of keys) {
      const key = mapSectionKey(raw);
      if (!validSectionKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  };

  const style = parsed.style;
  if (rawTemplate && !TEMPLATE_IDS.includes(rawTemplate as Resume['style']['template'])) {
    warnings.push(`Unknown template “${rawTemplate}” — using “${DEFAULT_STYLE.template}”.`);
  }
  const accentColor = HEX_COLOR_RE.test(style.accentColor.trim()) ? style.accentColor.trim() : DEFAULT_STYLE.accentColor;
  if (accentColor !== style.accentColor.trim() && style.accentColor.trim()) {
    warnings.push(`Accent colour “${style.accentColor.trim()}” is not a hex value — using ${DEFAULT_STYLE.accentColor}.`);
  }
  const fontSize = Number.isFinite(style.fontSize) ? Math.min(12, Math.max(9, style.fontSize)) : DEFAULT_STYLE.fontSize;

  let sectionOrder = cleanSectionKeys(style.sectionOrder);
  const missingBuiltIns = BUILT_IN_SECTIONS.filter((key) => !sectionOrder.includes(key));
  sectionOrder = [...sectionOrder, ...missingBuiltIns];
  const customKeys = customSections
    .map((section) => `custom:${section.id}` as SectionKey)
    .filter((key) => !sectionOrder.includes(key));
  sectionOrder = [...sectionOrder, ...customKeys];

  const createdAt = ISO_RE.test(parsed.createdAt) ? parsed.createdAt : blank.createdAt;

  const resume: Resume = {
    id: blank.id,
    name: parsed.name.trim() || parsed.contact.fullName.trim() || 'Imported resume',
    createdAt,
    updatedAt: nowIso(),
    contact: {
      fullName: parsed.contact.fullName.trim(),
      headline: parsed.contact.headline.trim(),
      email: parsed.contact.email.trim(),
      phone: parsed.contact.phone.trim(),
      location: parsed.contact.location.trim(),
      website: parsed.contact.website.trim(),
      linkedin: parsed.contact.linkedin.trim(),
      github: parsed.contact.github.trim(),
    },
    summary: parsed.summary.trim(),
    experience,
    education,
    skillGroups,
    projects,
    certifications,
    customSections,
    style: {
      template: style.template,
      accentColor,
      font: style.font,
      fontSize,
      density: style.density,
      pageSize: style.pageSize,
      sectionOrder,
      hiddenSections: cleanSectionKeys(style.hiddenSections),
    },
    ...(parsed.tailoredForJobId ? { tailoredForJobId: parsed.tailoredForJobId } : {}),
  };

  if (!hasAnyContent(resume)) {
    return { error: 'No resume data found in that file — expected our JSON export or a JSON Resume document.' };
  }

  const dateWarning = dates.warning();
  if (dateWarning) warnings.push(dateWarning);

  return { resume, warnings };
}
