/**
 * The shared "document model" for a resume: which sections render, in which order, and the
 * small derived strings (contact line, education headline, …) used by BOTH the on-screen
 * preview templates and the DOCX export. Keeping it here means the Word file and the PDF
 * always agree on content — only the presentation differs.
 *
 * Pure functions only: this module runs in the browser, inside the print iframe, and in node.
 */

import type {
  CertificationItem,
  ContactInfo,
  CustomSection,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  Resume,
  SectionKey,
  SkillGroup,
} from '@shared/types';
import { visibleSectionOrder } from '@/lib/resume/profile';
import { cleanList, displayUrl, formatPhone, formatRange, joinParts, linkHref } from '@/lib/resume/format';

export {
  cleanList,
  displayUrl,
  formatMonth,
  formatPhone,
  formatRange,
  joinParts,
  linkHref,
  DATE_SEPARATOR,
} from '@/lib/resume/format';

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export type SectionKind =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'custom';

export interface ResumeSection {
  /** `'experience'` or `'custom:<id>'`. */
  key: SectionKey;
  kind: SectionKind;
  /** Heading text as printed. */
  title: string;
  /** Present only for `kind === 'custom'`. */
  custom?: CustomSection;
}

export const DEFAULT_SECTION_TITLES: Record<Exclude<SectionKind, 'custom'>, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
};

function customSectionId(key: SectionKey): string | null {
  return key.startsWith('custom:') ? key.slice('custom:'.length) : null;
}

/** Does this experience row have anything worth printing? */
export function experienceHasContent(item: ExperienceItem): boolean {
  return Boolean(
    (item.title ?? '').trim() ||
      (item.company ?? '').trim() ||
      (item.startDate ?? '').trim() ||
      (item.endDate ?? '').trim() ||
      cleanList(item.bullets).length,
  );
}

export function educationHasContent(item: EducationItem): boolean {
  return Boolean(
    (item.school ?? '').trim() ||
      (item.degree ?? '').trim() ||
      (item.field ?? '').trim() ||
      cleanList(item.details).length,
  );
}

export function skillGroupHasContent(group: SkillGroup): boolean {
  return cleanList(group.skills).length > 0;
}

export function projectHasContent(item: ProjectItem): boolean {
  return Boolean(
    (item.name ?? '').trim() ||
      (item.description ?? '').trim() ||
      cleanList(item.bullets).length ||
      cleanList(item.technologies).length,
  );
}

export function certificationHasContent(item: CertificationItem): boolean {
  return Boolean((item.name ?? '').trim() || (item.issuer ?? '').trim());
}

export function customItemHasContent(item: CustomSection['items'][number]): boolean {
  return Boolean(
    (item.heading ?? '').trim() ||
      (item.subheading ?? '').trim() ||
      (item.date ?? '').trim() ||
      cleanList(item.bullets).length,
  );
}

/** Rows of each section that actually carry content (empty rows never print). */
export function sectionItems(resume: Resume, section: ResumeSection) {
  switch (section.kind) {
    case 'experience':
      return (resume.experience ?? []).filter(experienceHasContent);
    case 'education':
      return (resume.education ?? []).filter(educationHasContent);
    case 'skills':
      return (resume.skillGroups ?? []).filter(skillGroupHasContent);
    case 'projects':
      return (resume.projects ?? []).filter(projectHasContent);
    case 'certifications':
      return (resume.certifications ?? []).filter(certificationHasContent);
    case 'custom':
      return (section.custom?.items ?? []).filter(customItemHasContent);
    case 'summary':
    default:
      return [];
  }
}

function hasContent(resume: Resume, section: ResumeSection): boolean {
  if (section.kind === 'summary') return (resume.summary ?? '').trim().length > 0;
  return sectionItems(resume, section).length > 0;
}

function toSection(resume: Resume, key: SectionKey): ResumeSection | null {
  const customId = customSectionId(key);
  if (customId) {
    const custom = (resume.customSections ?? []).find((section) => section.id === customId);
    if (!custom) return null;
    return { key, kind: 'custom', title: (custom.title ?? '').trim() || 'Additional', custom };
  }
  const kind = key as Exclude<SectionKind, 'custom'>;
  const title = DEFAULT_SECTION_TITLES[kind];
  if (!title) return null;
  return { key, kind, title };
}

/**
 * The sections to render, honouring `style.sectionOrder`, dropping `style.hiddenSections`
 * and dropping sections with nothing in them (so no empty headings ever print).
 */
export function resumeSections(resume: Resume): ResumeSection[] {
  const out: ResumeSection[] = [];
  for (const key of visibleSectionOrder(resume)) {
    const section = toSection(resume, key);
    if (section && hasContent(resume, section)) out.push(section);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Header / contact
// ---------------------------------------------------------------------------

export interface ContactEntry {
  id: string;
  /** What the reader sees — never a raw URL with a protocol. */
  text: string;
  /** Absent for plain text entries such as the location. */
  href?: string;
}

/** The contact chips/line under (or beside) the name, in a stable, sensible reading order. */
export function contactEntries(contact: ContactInfo | undefined): ContactEntry[] {
  const c = contact ?? ({} as ContactInfo);
  const entries: ContactEntry[] = [];

  const location = (c.location ?? '').trim();
  if (location) entries.push({ id: 'location', text: location });

  const phone = formatPhone(c.phone);
  if (phone) entries.push({ id: 'phone', text: phone, href: `tel:${phone.replace(/[^\d+]/g, '')}` });

  const email = (c.email ?? '').trim();
  if (email) entries.push({ id: 'email', text: email, href: `mailto:${email}` });

  for (const [id, value] of [
    ['linkedin', c.linkedin],
    ['github', c.github],
    ['website', c.website],
  ] as const) {
    const text = displayUrl(value);
    if (text) entries.push({ id, text, href: linkHref(value) });
  }

  return entries;
}

export function fullName(resume: Resume): string {
  return (resume.contact?.fullName ?? '').trim();
}

export function headline(resume: Resume): string {
  return (resume.contact?.headline ?? '').trim();
}

// ---------------------------------------------------------------------------
// Per-item derived strings
// ---------------------------------------------------------------------------

export function experienceDates(item: ExperienceItem): string {
  return formatRange(item.startDate, item.endDate, item.current);
}

/** `"B.B.A., Marketing"` — the degree line of an education row. */
export function educationDegreeLine(item: EducationItem): string {
  const degree = (item.degree ?? '').trim();
  const field = (item.field ?? '').trim();
  if (degree && field) return `${degree}, ${field}`;
  return degree || field;
}

export function educationDates(item: EducationItem): string {
  return formatRange(item.startDate, item.endDate, false);
}

/** `"Texarkana, TX · GPA 3.7"` */
export function educationMeta(item: EducationItem): string {
  const gpa = (item.gpa ?? '').trim();
  return joinParts([(item.location ?? '').trim(), gpa ? `GPA ${gpa}` : '']);
}

export function skillGroupLine(group: SkillGroup): string {
  const skills = cleanList(group.skills).join(', ');
  const name = (group.name ?? '').trim();
  return name ? `${name}: ${skills}` : skills;
}

export function projectMeta(item: ProjectItem): string {
  return cleanList(item.technologies).join(', ');
}

export function certificationLine(item: CertificationItem): string {
  return joinParts([(item.name ?? '').trim(), (item.issuer ?? '').trim()], ' — ');
}

export function certificationDate(item: CertificationItem): string {
  const value = (item.date ?? '').trim();
  return formatRange(value, '', false) || value;
}

/** Plain-text label used for the DOCX/ATS-friendly variant of a link. */
export function contactLine(contact: ContactInfo | undefined): string {
  return joinParts(contactEntries(contact).map((entry) => entry.text));
}
