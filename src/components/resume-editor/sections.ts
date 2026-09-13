/**
 * Section-key helpers shared by the editor panels.
 *
 * The editor shows *every* section (including hidden ones, which get an "eye" toggle), so it
 * cannot reuse `visibleSectionOrder()` from src/lib/resume/profile.ts — that one drops hidden keys.
 */
import type { Resume, SectionKey } from '@shared/types';
import { BUILT_IN_SECTIONS } from '@shared/types';

export const BUILT_IN_SECTION_LABELS: Record<string, string> = {
  summary: 'Professional summary',
  experience: 'Work experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
};

export function isCustomSectionKey(key: SectionKey): boolean {
  return key.startsWith('custom:');
}

export function customSectionId(key: SectionKey): string | null {
  return key.startsWith('custom:') ? key.slice('custom:'.length) : null;
}

export function customSectionKey(id: string): SectionKey {
  return `custom:${id}` as SectionKey;
}

/** Human label for a section key, resolving custom sections through the resume. */
export function sectionLabel(resume: Resume, key: SectionKey): string {
  const id = customSectionId(key);
  if (id) {
    const found = (resume.customSections ?? []).find((s) => s.id === id);
    return found?.title?.trim() || 'Custom section';
  }
  return BUILT_IN_SECTION_LABELS[key] ?? key;
}

/**
 * Every section the editor should render, in the user's order, with unlisted sections appended.
 * Hidden sections are kept — the editor needs them so they can be un-hidden.
 */
export function editorSectionKeys(resume: Resume): SectionKey[] {
  const custom: SectionKey[] = (resume.customSections ?? []).map((s) => customSectionKey(s.id));
  const known: SectionKey[] = [...BUILT_IN_SECTIONS, ...custom];
  const knownSet = new Set<SectionKey>(known);
  const out: SectionKey[] = [];
  const seen = new Set<SectionKey>();
  for (const key of resume.style?.sectionOrder ?? []) {
    if (!knownSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of known) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Count shown in a collapsed panel header, e.g. "3 roles". */
export function sectionSummary(resume: Resume, key: SectionKey): string {
  const id = customSectionId(key);
  if (id) {
    const section = (resume.customSections ?? []).find((s) => s.id === id);
    return plural(section?.items.length ?? 0, 'entry', 'entries');
  }
  switch (key) {
    case 'summary': {
      const words = resume.summary.trim() ? resume.summary.trim().split(/\s+/).length : 0;
      return words ? plural(words, 'word', 'words') : 'Empty';
    }
    case 'experience':
      return plural(resume.experience.length, 'role', 'roles');
    case 'education':
      return plural(resume.education.length, 'school', 'schools');
    case 'skills':
      return plural(
        resume.skillGroups.reduce((n, g) => n + g.skills.length, 0),
        'skill',
        'skills',
      );
    case 'projects':
      return plural(resume.projects.length, 'project', 'projects');
    case 'certifications':
      return plural(resume.certifications.length, 'certification', 'certifications');
    default:
      return '';
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Move an item inside an array, returning a new array. Out-of-range moves are no-ops. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
