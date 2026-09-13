import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink } from 'lucide-react';
import type { ApplicationStatus, TrackedJob } from '@shared/types';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from '@shared/types';
import { Badge, Button, Select, cx } from '@/components/ui';
import { STATUS_TONE, daysSince, followUpLabel, isFollowUpOverdue } from './utils';

export type SortKey = 'title' | 'company' | 'status' | 'match' | 'saved' | 'followUp';
export type SortDirection = 'asc' | 'desc';

export interface ListViewProps {
  entries: TrackedJob[];
  scores: Record<string, number>;
  hasResume: boolean;
  onOpen: (jobId: string) => void;
  onStatusChange: (jobId: string, status: ApplicationStatus) => void;
}

const STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({
  value: status,
  label: APPLICATION_STATUS_LABELS[status],
}));

const STATUS_RANK: Record<ApplicationStatus, number> = {
  saved: 0,
  applied: 1,
  interviewing: 2,
  offer: 3,
  rejected: 4,
  archived: 5,
};

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'title', label: 'Role' },
  { key: 'company', label: 'Company' },
  { key: 'status', label: 'Status' },
  { key: 'match', label: 'Match', numeric: true },
  { key: 'saved', label: 'Age', numeric: true },
  { key: 'followUp', label: 'Follow-up' },
];

function compare(a: TrackedJob, b: TrackedJob, key: SortKey, scores: Record<string, number>): number {
  switch (key) {
    case 'title':
      return a.job.title.localeCompare(b.job.title);
    case 'company':
      return a.job.company.localeCompare(b.job.company);
    case 'status':
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case 'match':
      return (scores[a.job.id] ?? -1) - (scores[b.job.id] ?? -1);
    case 'saved':
      return (daysSince(a.savedAt) ?? 0) - (daysSince(b.savedAt) ?? 0);
    case 'followUp': {
      const av = a.followUpOn ?? '9999-99-99';
      const bv = b.followUpOn ?? '9999-99-99';
      return av.localeCompare(bv);
    }
    default:
      return 0;
  }
}

/** Dense table view of the same data as the board, with sortable columns. */
export function ListView({ entries, scores, hasResume, onOpen, onStatusChange }: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('saved');
  const [direction, setDirection] = useState<SortDirection>('asc');

  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      const raw = compare(a, b, sortKey, scores);
      return direction === 'asc' ? raw : -raw;
    });
    return copy;
  }, [entries, sortKey, direction, scores]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection(key === 'match' ? 'desc' : 'asc');
  };

  return (
    <div className="tr-table-wrap">
      <table className="tr-table">
        <caption className="visually-hidden">Tracked applications, sortable by column</caption>
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = col.key === sortKey;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={cx(col.numeric && 'tr-num')}
                  aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className="tr-sort" onClick={() => toggleSort(col.key)}>
                    {col.label}
                    {active ? (
                      direction === 'asc' ? (
                        <ArrowUp size={12} aria-hidden="true" />
                      ) : (
                        <ArrowDown size={12} aria-hidden="true" />
                      )
                    ) : (
                      <ChevronsUpDown size={12} aria-hidden="true" className="tr-sort-idle" />
                    )}
                  </button>
                </th>
              );
            })}
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => {
            const days = daysSince(entry.appliedAt ?? entry.savedAt);
            const follow = followUpLabel(entry.followUpOn);
            const overdue = isFollowUpOverdue(entry.followUpOn);
            return (
              <tr key={entry.job.id}>
                <td>
                  <button type="button" className="tr-linkish" onClick={() => onOpen(entry.job.id)}>
                    {entry.job.title}
                  </button>
                </td>
                <td>{entry.job.company || '—'}</td>
                <td>
                  <label className="visually-hidden" htmlFor={`tr-row-status-${entry.job.id}`}>
                    Status for {entry.job.title}
                  </label>
                  <Select
                    id={`tr-row-status-${entry.job.id}`}
                    uiSize="sm"
                    value={entry.status}
                    options={STATUS_OPTIONS}
                    onChange={(e) => onStatusChange(entry.job.id, e.target.value as ApplicationStatus)}
                  />
                </td>
                <td className="tr-num">
                  {hasResume ? (
                    <Badge tone={STATUS_TONE[entry.status]} variant="outline" size="sm">
                      {scores[entry.job.id] ?? 0}%
                    </Badge>
                  ) : (
                    <span className="subtle">—</span>
                  )}
                </td>
                <td className="tr-num">{days === null ? '—' : `${days}d`}</td>
                <td>
                  {follow ? (
                    <span className={cx(overdue && 'tr-overdue')}>{follow}</span>
                  ) : (
                    <span className="subtle">Not set</span>
                  )}
                </td>
                <td className="tr-row-actions">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(entry.job.id)}>
                    Details
                  </Button>
                  {entry.job.url && (
                    <a
                      className="tr-card-link"
                      href={entry.job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open the ${entry.job.title} posting`}
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
