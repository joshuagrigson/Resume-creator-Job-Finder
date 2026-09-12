/**
 * Turns a `Resume` into the flat shapes the matcher needs:
 *  - `resumeToPlainText` — the whole resume as readable text, in render order.
 *  - `resumeProfile`     — skills / titles / headline / years for `scoreJobMatch`.
 *
 * Everything here is pure; no store access, no DOM.
 */

import type { ExperienceItem, Resume, SectionKey } from '@shared/types';
import { BUILT_IN_SECTIONS } from '@shared/types';
import type { ResumeProfile } from '@shared/match';
import { canonicalSkillFor, extractSkills } from '@shared/keywords';
import { collapseWhitespace } from '@shared/text';

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

function monthLabel(date: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(date.trim());
  if (!match) return date.trim();
  const monthIndex = Number(match[2]) - 1;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const name = names[monthIndex];
  return name ? `${name} ${match[1]}` : match[1];
}

function dateRange(startDate: string, endDate: string, current: boolean): string {
  const start = monthLabel(startDate ?? '');
  const end = current ? 'Present' : monthLabel(endDate ?? '');
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

/** Join the non-empty pieces of a header line with a separator. */
function line(parts: (string | undefined)[], separator = ' · '): string {
  return parts.map((p) => (p ?? '').trim()).filter(Boolean).join(separator);
}

/**
 * Resolve the order sections are rendered in: the user's `sectionOrder` first, then any
 * section that is not listed there, with hidden sections removed.
 */
export function visibleSectionOrder(resume: Resume): SectionKey[] {
  const custom: SectionKey[] = (resume.customSections ?? []).map((section) => `custom:${section.id}` as SectionKey);
  const known: SectionKey[] = [...BUILT_IN_SECTIONS, ...custom];
  const knownSet = new Set<SectionKey>(known);
  const hidden = new Set<SectionKey>(resume.style?.hiddenSections ?? []);
  const ordered: SectionKey[] = [];
  const seen = new Set<SectionKey>();
  for (const key of resume.style?.sectionOrder ?? []) {
    if (!knownSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  for (const key of known) {
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered.filter((key) => !hidden.has(key));
}

function sectionText(resume: Resume, key: SectionKey): string[] {
  const out: string[] = [];
  switch (key) {
    case 'summary': {
      const summary = (resume.summary ?? '').trim();
      if (summary) {
        out.push('Summary');
        out.push(summary);
      }
      return out;
    }
    case 'experience': {
      const items = resume.experience ?? [];
      const rendered: string[] = [];
      for (const item of items) {
        const header = line([item.title, item.company, item.location]);
        const dates = dateRange(item.startDate, item.endDate, item.current);
        const head = line([header, dates], ' — ');
        const bullets = (item.bullets ?? []).map((b) => b.trim()).filter(Boolean);
        if (!head && bullets.length === 0) continue;
        if (head) rendered.push(head);
        for (const bullet of bullets) rendered.push(bullet);
      }
      if (rendered.length) {
        out.push('Experience');
        out.push(...rendered);
      }
      return out;
    }
    case 'education': {
      const rendered: string[] = [];
      for (const item of resume.education ?? []) {
        const degree = line([item.degree, item.field], ', ');
        const head = line([degree, item.school, item.location]);
        const dates = dateRange(item.startDate, item.endDate, false);
        const full = line([head, dates], ' — ');
        const gpa = (item.gpa ?? '').trim();
        const withGpa = gpa ? line([full, `GPA ${gpa}`], ' — ') : full;
        if (withGpa) rendered.push(withGpa);
        for (const detail of item.details ?? []) {
          const trimmed = detail.trim();
          if (trimmed) rendered.push(trimmed);
        }
      }
      if (rendered.length) {
        out.push('Education');
        out.push(...rendered);
      }
      return out;
    }
    case 'skills': {
      const rendered: string[] = [];
      for (const group of resume.skillGroups ?? []) {
        const skills = (group.skills ?? []).map((s) => s.trim()).filter(Boolean);
        if (skills.length === 0) continue;
        const name = (group.name ?? '').trim();
        rendered.push(name ? `${name}: ${skills.join(', ')}` : skills.join(', '));
      }
      if (rendered.length) {
        out.push('Skills');
        out.push(...rendered);
      }
      return out;
    }
    case 'projects': {
      const rendered: string[] = [];
      for (const item of resume.projects ?? []) {
        const head = line([item.name, item.url]);
        const description = (item.description ?? '').trim();
        const bullets = (item.bullets ?? []).map((b) => b.trim()).filter(Boolean);
        const tech = (item.technologies ?? []).map((t) => t.trim()).filter(Boolean);
        if (!head && !description && bullets.length === 0 && tech.length === 0) continue;
        if (head) rendered.push(head);
        if (description) rendered.push(description);
        for (const bullet of bullets) rendered.push(bullet);
        if (tech.length) rendered.push(`Technologies: ${tech.join(', ')}`);
      }
      if (rendered.length) {
        out.push('Projects');
        out.push(...rendered);
      }
      return out;
    }
    case 'certifications': {
      const rendered: string[] = [];
      for (const item of resume.certifications ?? []) {
        const text = line([item.name, item.issuer, item.date]);
        if (text) rendered.push(text);
      }
      if (rendered.length) {
        out.push('Certifications');
        out.push(...rendered);
      }
      return out;
    }
    default: {
      const id = key.startsWith('custom:') ? key.slice('custom:'.length) : '';
      const section = (resume.customSections ?? []).find((s) => s.id === id);
      if (!section) return out;
      const rendered: string[] = [];
      for (const item of section.items ?? []) {
        const head = line([item.heading, item.subheading, item.date], ' — ');
        if (head) rendered.push(head);
        for (const bullet of item.bullets ?? []) {
          const trimmed = bullet.trim();
          if (trimmed) rendered.push(trimmed);
        }
      }
      if (rendered.length) {
        out.push((section.title ?? '').trim() || 'Additional');
        out.push(...rendered);
      }
      return out;
    }
  }
}

/**
 * The resume as plain text in reading order: contact block, then every visible section in
 * the order it renders. Used for keyword matching, ATS word counts and AI prompts.
 */
export function resumeToPlainText(resume: Resume): string {
  if (!resume) return '';
  const lines: string[] = [];
  const contact = resume.contact;
  if (contact) {
    const name = (contact.fullName ?? '').trim();
    if (name) lines.push(name);
    const headline = (contact.headline ?? '').trim();
    if (headline) lines.push(headline);
    const details = line([contact.email, contact.phone, contact.location]);
    if (details) lines.push(details);
    const links = line([contact.website, contact.linkedin, contact.github]);
    if (links) lines.push(links);
  }
  for (const key of visibleSectionOrder(resume)) {
    const section = sectionText(resume, key);
    if (section.length === 0) continue;
    lines.push('');
    lines.push(...section);
  }
  return collapseWhitespace(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Years of experience
// ---------------------------------------------------------------------------

function monthIndex(date: string): number | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec((date ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return year * 12 + (month - 1);
}

/**
 * Total months of professional experience with overlapping roles counted once.
 * `current: true` runs to `today` (defaults to now, injectable for deterministic tests).
 */
export function experienceMonths(items: readonly ExperienceItem[], today: Date = new Date()): number {
  const nowIndex = today.getFullYear() * 12 + today.getMonth();
  const ranges: [number, number][] = [];
  for (const item of items ?? []) {
    const start = monthIndex(item.startDate);
    if (start === null) continue;
    let end = item.current ? nowIndex : monthIndex(item.endDate);
    if (end === null) end = start;
    if (end < start) end = start;
    ranges.push([start, Math.min(end, Math.max(nowIndex, start))]);
  }
  if (ranges.length === 0) return 0;
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let months = 0;
  let [spanStart, spanEnd] = ranges[0];
  for (let i = 1; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    if (start <= spanEnd + 1) {
      if (end > spanEnd) spanEnd = end;
    } else {
      months += spanEnd - spanStart + 1;
      spanStart = start;
      spanEnd = end;
    }
  }
  months += spanEnd - spanStart + 1;
  return months;
}

/** Years of experience, one decimal place, overlaps merged. */
export function yearsOfExperience(items: readonly ExperienceItem[], today: Date = new Date()): number {
  return Math.round((experienceMonths(items, today) / 12) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function tidySkill(raw: string): string {
  return collapseWhitespace(raw).replace(/[.,;]+$/, '').trim();
}

/**
 * Flatten a resume into the shape `scoreJobMatch` consumes.
 *
 * `skills` is the union of every skill group (canonicalized against the dictionary when a
 * match exists, otherwise kept in the user's own casing) and the dictionary skills found
 * in the summary, bullets, projects and certifications.
 */
export function resumeProfile(resume: Resume, today: Date = new Date()): ResumeProfile {
  const text = resumeToPlainText(resume);

  const skills: string[] = [];
  const seen = new Set<string>();
  const push = (value: string): void => {
    const clean = tidySkill(value);
    if (!clean) return;
    const canonical = canonicalSkillFor(clean);
    const display = canonical ?? clean;
    const key = display.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    skills.push(display);
  };

  for (const group of resume?.skillGroups ?? []) {
    for (const skill of group.skills ?? []) push(skill);
  }
  for (const project of resume?.projects ?? []) {
    for (const tech of project.technologies ?? []) push(tech);
  }
  for (const canonical of extractSkills(text)) push(canonical);

  const titles: string[] = [];
  const titleSeen = new Set<string>();
  for (const item of resume?.experience ?? []) {
    const title = (item.title ?? '').trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (titleSeen.has(key)) continue;
    titleSeen.add(key);
    titles.push(title);
  }

  return {
    skills,
    titles,
    headline: (resume?.contact?.headline ?? '').trim(),
    text,
    yearsExperience: yearsOfExperience(resume?.experience ?? [], today),
  };
}
