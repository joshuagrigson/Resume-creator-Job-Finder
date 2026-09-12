/**
 * Cross-board de-duplication.
 *
 * The same posting routinely appears on Remotive, Remote OK and Jobicy at once. We key on
 * the normalized (title, company) pair, keep the newest posting, break ties on description
 * length, merge tags, and backfill anything the winner is missing from the loser.
 */
import type { Job } from '../../shared/types';

/** Lowercase, strip punctuation/decoration, collapse whitespace. */
export function normalizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\((?:m\/w\/d|m\/f\/d|h\/f|w\/m\/d|all genders)\)/g, ' ')
    .replace(/[^a-z0-9+#. ]+/g, ' ')
    .replace(/\b(inc|llc|ltd|gmbh|bv|nv|sa|ag|corp|co|plc|limited)\b\.?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeKey(job: Pick<Job, 'title' | 'company'>): string {
  return `${normalizeKeyPart(job.title)}|${normalizeKeyPart(job.company)}`;
}

function time(job: Job): number {
  const ms = Date.parse(job.postedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/** `true` when `candidate` should replace `current`. */
function prefers(candidate: Job, current: Job): boolean {
  const candidateTime = time(candidate);
  const currentTime = time(current);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return candidate.descriptionText.length > current.descriptionText.length;
}

function mergeTags(primary: readonly string[], secondary: readonly string[]): string[] {
  const seen = new Set(primary);
  const out = [...primary];
  for (const tag of secondary) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 30) break;
  }
  return out;
}

/** Winner keeps its identity; anything it lacks is filled in from the duplicate. */
function merge(winner: Job, loser: Job): Job {
  const merged: Job = { ...winner, tags: mergeTags(winner.tags, loser.tags) };
  if (!merged.companyLogo && loser.companyLogo) merged.companyLogo = loser.companyLogo;
  if (!merged.employmentType && loser.employmentType) merged.employmentType = loser.employmentType;
  if (!merged.category && loser.category) merged.category = loser.category;
  if (!merged.salary && loser.salary) merged.salary = loser.salary;
  if (!merged.location && loser.location) merged.location = loser.location;
  if (loser.remote) merged.remote = true;
  if (loser.descriptionText.length > merged.descriptionText.length) {
    merged.descriptionText = loser.descriptionText;
    merged.descriptionHtml = loser.descriptionHtml;
  }
  return merged;
}

/**
 * Collapse duplicates while preserving the order in which each posting was first seen.
 */
export function dedupeJobs(jobs: readonly Job[]): Job[] {
  const order: string[] = [];
  const byKey = new Map<string, Job>();

  for (const job of jobs) {
    const key = dedupeKey(job);
    const existing = byKey.get(key);
    if (!existing) {
      order.push(key);
      byKey.set(key, job);
      continue;
    }
    byKey.set(key, prefers(job, existing) ? merge(job, existing) : merge(existing, job));
  }

  return order.map((key) => byKey.get(key)).filter((job): job is Job => job !== undefined);
}
