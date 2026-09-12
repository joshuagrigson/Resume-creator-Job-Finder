/**
 * POST /api/ai/parse-resume — pasted resume text → the Resume subset the client can import.
 *
 * The model never supplies ids: they are generated here with crypto.randomUUID() so the client
 * gets stable, collision-free keys. Dates are coerced to "YYYY-MM" and arrays are never null.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  AiParseResumeResponse,
  CertificationItem,
  ContactInfo,
  CustomSection,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  SkillGroup,
} from '../../../shared/types';
import { requestJson, type AiClient } from '../client';
import { PARSE_RESUME_OUTPUT_SCHEMA, parseResumePrompt } from '../prompts';
import type { ParseResumeInput } from '../schemas';

const text = z
  .string()
  .nullish()
  .transform((value) => (typeof value === 'string' ? value : ''));
const textList = z
  .array(text)
  .nullish()
  .transform((value) => value ?? []);
const flag = z
  .boolean()
  .nullish()
  .transform((value) => value === true);

function list<T extends z.ZodTypeAny>(item: T) {
  return z
    .array(item)
    .nullish()
    .transform((value) => value ?? []);
}

const EMPTY_CONTACT: ContactInfo = {
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  linkedin: '',
  github: '',
};

const ContactOutputSchema = z.object({
  fullName: text,
  headline: text,
  email: text,
  phone: text,
  location: text,
  website: text,
  linkedin: text,
  github: text,
});

const OutputSchema = z.object({
  contact: ContactOutputSchema.nullish().transform((value) => value ?? EMPTY_CONTACT),
  summary: text,
  experience: list(
    z.object({
      company: text,
      title: text,
      location: text,
      startDate: text,
      endDate: text,
      current: flag,
      bullets: textList,
    }),
  ),
  education: list(
    z.object({
      school: text,
      degree: text,
      field: text,
      location: text,
      startDate: text,
      endDate: text,
      gpa: text,
      details: textList,
    }),
  ),
  skillGroups: list(z.object({ name: text, skills: textList })),
  projects: list(
    z.object({ name: text, url: text, description: text, bullets: textList, technologies: textList }),
  ),
  certifications: list(z.object({ name: text, issuer: text, date: text, url: text })),
  customSections: list(
    z.object({
      title: text,
      items: list(z.object({ heading: text, subheading: text, date: text, bullets: textList })),
    }),
  ),
});

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function format(year: string, month: number): string {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return '';
  const m = Math.min(12, Math.max(1, month));
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Coerces the many date shapes a resume can use into "YYYY-MM" (or "" when unknown). */
export function normalizeMonth(raw: string): string {
  const value = raw.trim();
  if (value === '' || /^(present|current|now|ongoing|n\/?a|tbd)$/i.test(value)) return '';

  let m = /^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/.exec(value);
  if (m) return format(m[1] as string, Number(m[2]));

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (m) return format(m[3] as string, Number(m[1]));

  m = /^(\d{1,2})[-/.](\d{4})$/.exec(value);
  if (m) return format(m[2] as string, Number(m[1]));

  m = /^(\d{4})$/.exec(value);
  if (m) return format(m[1] as string, 1);

  m = /^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(value);
  if (m) {
    const month = MONTHS[(m[1] as string).toLowerCase()];
    if (month) return format(m[2] as string, month);
  }

  return '';
}

const LIMITS = { items: 30, bullets: 24, skills: 60, groups: 12, chars: 600 };

function cleanLine(value: string): string {
  return value.replace(/^[-•*–—\s]+/, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.chars);
}

function cleanList(values: readonly string[], limit = LIMITS.bullets): string[] {
  const out: string[] = [];
  for (const value of values) {
    const line = cleanLine(value);
    if (line === '') continue;
    out.push(line);
    if (out.length === limit) break;
  }
  return out;
}

type Parsed = z.infer<typeof OutputSchema>;

/** Fills ids, normalizes dates, trims text and guarantees arrays. Exported for tests. */
export function normalizeParsedResume(parsed: Parsed): AiParseResumeResponse['resume'] {
  const contact: ContactInfo = {
    fullName: cleanLine(parsed.contact.fullName),
    headline: cleanLine(parsed.contact.headline),
    email: cleanLine(parsed.contact.email),
    phone: cleanLine(parsed.contact.phone),
    location: cleanLine(parsed.contact.location),
    website: cleanLine(parsed.contact.website),
    linkedin: cleanLine(parsed.contact.linkedin),
    github: cleanLine(parsed.contact.github),
  };

  const experience: ExperienceItem[] = parsed.experience.slice(0, LIMITS.items).map((item) => {
    const endDate = normalizeMonth(item.endDate);
    const current = item.current || /^(present|current|now)$/i.test(item.endDate.trim());
    return {
      id: randomUUID(),
      company: cleanLine(item.company),
      title: cleanLine(item.title),
      location: cleanLine(item.location),
      startDate: normalizeMonth(item.startDate),
      endDate: current ? '' : endDate,
      current,
      bullets: cleanList(item.bullets),
    };
  });

  const education: EducationItem[] = parsed.education.slice(0, LIMITS.items).map((item) => ({
    id: randomUUID(),
    school: cleanLine(item.school),
    degree: cleanLine(item.degree),
    field: cleanLine(item.field),
    location: cleanLine(item.location),
    startDate: normalizeMonth(item.startDate),
    endDate: normalizeMonth(item.endDate),
    gpa: cleanLine(item.gpa),
    details: cleanList(item.details),
  }));

  const skillGroups: SkillGroup[] = parsed.skillGroups
    .slice(0, LIMITS.groups)
    .map((group) => ({
      id: randomUUID(),
      name: cleanLine(group.name) || 'Skills',
      skills: cleanList(group.skills, LIMITS.skills),
    }))
    .filter((group) => group.skills.length > 0);

  const projects: ProjectItem[] = parsed.projects.slice(0, LIMITS.items).map((project) => ({
    id: randomUUID(),
    name: cleanLine(project.name),
    url: cleanLine(project.url),
    description: cleanLine(project.description),
    bullets: cleanList(project.bullets),
    technologies: cleanList(project.technologies, LIMITS.skills),
  }));

  const certifications: CertificationItem[] = parsed.certifications.slice(0, LIMITS.items).map((cert) => ({
    id: randomUUID(),
    name: cleanLine(cert.name),
    issuer: cleanLine(cert.issuer),
    date: normalizeMonth(cert.date) || cleanLine(cert.date),
    url: cleanLine(cert.url),
  }));

  const customSections: CustomSection[] = parsed.customSections.slice(0, LIMITS.groups).map((custom) => ({
    id: randomUUID(),
    title: cleanLine(custom.title) || 'Additional',
    items: custom.items.slice(0, LIMITS.items).map((item) => ({
      id: randomUUID(),
      heading: cleanLine(item.heading),
      subheading: cleanLine(item.subheading),
      date: normalizeMonth(item.date) || cleanLine(item.date),
      bullets: cleanList(item.bullets),
    })),
  }));

  return {
    contact,
    summary: parsed.summary.replace(/\s+/g, ' ').trim().slice(0, 2000),
    experience,
    education,
    skillGroups,
    projects,
    certifications,
    customSections,
  };
}

export async function parseResume(input: ParseResumeInput, client?: AiClient): Promise<AiParseResumeResponse> {
  const { system, user } = parseResumePrompt(input);
  const parsed = await requestJson(
    { system, user, maxTokens: 8000, effort: 'high', jsonSchema: PARSE_RESUME_OUTPUT_SCHEMA, client },
    OutputSchema,
  );
  return { resume: normalizeParsedResume(parsed) };
}
