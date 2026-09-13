/**
 * Small date/format helpers used by the dashboard cards. Pure and testable —
 * `now` / `today` are injectable so tests never depend on the wall clock.
 */

const MS_PER_DAY = 86_400_000;

/** "just now" · "12 min ago" · "3 hours ago" · "yesterday" · "5 days ago" · "12 Mar 2025". */
export function formatRelativeTime(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return 'never';
  const then = new Date(iso);
  const ms = then.getTime();
  if (!Number.isFinite(ms)) return 'never';

  const diff = now.getTime() - ms;
  if (diff < 45_000) return 'just now';

  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(diff / MS_PER_DAY);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;

  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Parses a `"YYYY-MM-DD"` string as a local calendar date. Returns null when unusable. */
export function parseDateOnly(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from today to `"YYYY-MM-DD"`. Negative when the date has passed. */
export function daysUntil(value: string | undefined, today: Date = new Date()): number | null {
  const target = parseDateOnly(value);
  if (!target) return null;
  return Math.round((target.getTime() - startOfDay(today).getTime()) / MS_PER_DAY);
}

/** "Overdue by 2 days" · "Due today" · "Tomorrow" · "In 4 days". */
export function formatDueLabel(days: number): string {
  if (days < -1) return `Overdue by ${Math.abs(days)} days`;
  if (days === -1) return 'Overdue by 1 day';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Follow-ups that are overdue or land within the next `withinDays` days. */
export function isFollowUpDue(value: string | undefined, withinDays = 7, today: Date = new Date()): boolean {
  const days = daysUntil(value, today);
  return days !== null && days <= withinDays;
}
