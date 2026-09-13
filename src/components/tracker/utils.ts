/**
 * Small pure helpers shared by the tracker board, list and detail views.
 * No store access and no DOM so they stay trivially testable.
 */
import type { ApplicationStatus, TrackedJob } from '@shared/types';
import type { BadgeTone } from '@/components/ui';

/** Badge tone per pipeline stage. Colour never carries the meaning alone — the label is always shown. */
export const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  saved: 'neutral',
  applied: 'accent',
  interviewing: 'info',
  offer: 'success',
  rejected: 'danger',
  archived: 'neutral',
};

const MS_PER_DAY = 86_400_000;

/** Local calendar date as "YYYY-MM-DD" (the format the follow-up input uses). */
export function todayIsoDate(today: Date = new Date()): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days between an ISO timestamp and now. Returns null for missing/unparseable input. */
export function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / MS_PER_DAY));
}

/** "today" / "yesterday" / "5 days ago" — used on cards where space is tight. */
export function formatDayCount(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** The date a card's age is measured from: when applied, the application date wins. */
export function ageLabel(entry: TrackedJob, now: Date = new Date()): string {
  if (entry.appliedAt) return `Applied ${formatDayCount(daysSince(entry.appliedAt, now))}`;
  return `Saved ${formatDayCount(daysSince(entry.savedAt, now))}`;
}

/** A follow-up is overdue once its calendar day is in the past. */
export function isFollowUpOverdue(followUpOn: string | undefined, now: Date = new Date()): boolean {
  if (!followUpOn) return false;
  return followUpOn < todayIsoDate(now);
}

/** "Follow up today" / "Follow up in 3 days" / "Follow-up overdue by 2 days". */
export function followUpLabel(followUpOn: string | undefined, now: Date = new Date()): string | null {
  if (!followUpOn) return null;
  const today = todayIsoDate(now);
  if (followUpOn === today) return 'Follow up today';
  const target = Date.parse(`${followUpOn}T00:00:00`);
  const base = Date.parse(`${today}T00:00:00`);
  if (!Number.isFinite(target) || !Number.isFinite(base)) return `Follow up ${followUpOn}`;
  const diff = Math.round((target - base) / MS_PER_DAY);
  if (diff < 0) {
    const late = Math.abs(diff);
    return `Follow-up ${late === 1 ? '1 day' : `${late} days`} overdue`;
  }
  return `Follow up in ${diff === 1 ? '1 day' : `${diff} days`}`;
}

/** Case-insensitive "search within" over the fields a user would type. */
export function matchesFilter(entry: TrackedJob, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    entry.job.title,
    entry.job.company,
    entry.job.location,
    entry.notes,
    ...(entry.job.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/** Group entries by status, preserving the order they arrive in. */
export function groupByStatus(entries: readonly TrackedJob[]): Record<ApplicationStatus, TrackedJob[]> {
  const groups = {
    saved: [] as TrackedJob[],
    applied: [] as TrackedJob[],
    interviewing: [] as TrackedJob[],
    offer: [] as TrackedJob[],
    rejected: [] as TrackedJob[],
    archived: [] as TrackedJob[],
  };
  for (const entry of entries) groups[entry.status].push(entry);
  return groups;
}
