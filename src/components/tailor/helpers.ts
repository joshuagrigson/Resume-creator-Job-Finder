/**
 * Pure helpers for the tailor page: HTML sanitizing, skill insertion and AI error copy.
 * Kept free of React so the tests can exercise them directly.
 */
import DOMPurify from 'dompurify';
import type { Job, Resume, SkillGroup } from '@shared/types';
import { createSkillGroup } from '@/lib/resume/defaults';
import { ApiClientError } from '@/lib/api';

/**
 * Sanitize untrusted posting HTML and force every surviving link to open safely.
 * Styles, images and inline SVG are dropped — a job ad has no business shipping those here.
 */
export function sanitizeJobHtml(html: string): string {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'img', 'svg'],
  });
  if (typeof document === 'undefined') return clean;
  const holder = document.createElement('div');
  holder.innerHTML = clean;
  for (const anchor of Array.from(holder.querySelectorAll('a[href]'))) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }
  return holder.innerHTML;
}

/** Job text used for matching: the plain text the server produced, else the sanitized HTML. */
export function jobTextOf(job: Pick<Job, 'descriptionText' | 'descriptionHtml'> | null | undefined): string {
  if (!job) return '';
  const text = (job.descriptionText ?? '').trim();
  if (text) return text;
  const html = (job.descriptionHtml ?? '').trim();
  if (!html) return '';
  return sanitizeJobHtml(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every skill already on the resume, lowercased, for "do I have this?" checks. */
export function resumeSkillSet(resume: Resume | undefined): Set<string> {
  const set = new Set<string>();
  for (const group of resume?.skillGroups ?? []) {
    for (const skill of group.skills ?? []) {
      const clean = skill.trim().toLowerCase();
      if (clean) set.add(clean);
    }
  }
  return set;
}

/**
 * Append skills to the first skill group, creating one when the resume has none.
 * Returns the same resume object when there is nothing new to add.
 */
export function withSkillsAdded(resume: Resume, incoming: readonly string[]): Resume {
  const existing = resumeSkillSet(resume);
  const additions: string[] = [];
  for (const raw of incoming) {
    const skill = raw.trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    additions.push(skill);
  }
  if (additions.length === 0) return resume;

  const groups: SkillGroup[] = [...(resume.skillGroups ?? [])];
  if (groups.length === 0) {
    groups.push(createSkillGroup({ name: 'Skills', skills: [] }));
  }
  const first = groups[0];
  groups[0] = { ...first, skills: [...(first.skills ?? []), ...additions] };
  return { ...resume, skillGroups: groups };
}

export interface AiErrorCopy {
  title: string;
  description: string;
  /** Offer a retry button for transient failures only. */
  retryable: boolean;
}

/** Turn an ApiClientError into copy a human can act on. */
export function aiErrorCopy(error: unknown): AiErrorCopy {
  if (error instanceof ApiClientError) {
    if (error.code === 'ai_disabled' || error.status === 503) {
      return {
        title: 'AI features are switched off',
        description:
          'The API server has no ANTHROPIC_API_KEY. Add one to the server environment and restart it — everything else on this page keeps working without it.',
        retryable: false,
      };
    }
    if (error.code === 'rate_limited' || error.status === 429) {
      return {
        title: 'Too many requests',
        description: 'The AI endpoint is rate limited. Wait a minute or two, then try again.',
        retryable: true,
      };
    }
    if (error.code === 'timeout') {
      return { title: 'That took too long', description: 'The request timed out before the model replied. Try again.', retryable: true };
    }
    return { title: 'AI request failed', description: error.message || 'The server returned an error.', retryable: true };
  }
  return { title: 'AI request failed', description: (error as Error)?.message || 'Unexpected error.', retryable: true };
}
