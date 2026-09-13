import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, KanbanSquare, Rows3, Search } from 'lucide-react';
import type { ApplicationStatus } from '@shared/types';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from '@shared/types';
import { scoreJobMatch } from '@shared/match';
import { resumeProfile } from '@/lib/resume/profile';
import { Badge, Button, EmptyState, Input, PageHeader, useToast } from '@/components/ui';
import { Board, ListView, TrackedDetail, groupByStatus, isFollowUpOverdue, matchesFilter } from '@/components/tracker';
import '@/components/tracker/tracker.css';
import { useJobStore, useTrackedJobs } from '@/stores/jobStore';
import { useActiveResume } from '@/stores/resumeStore';

type ViewMode = 'board' | 'list';

export default function TrackerPage() {
  const entries = useTrackedJobs();
  const setStatus = useJobStore((s) => s.setStatus);
  const activeResume = useActiveResume();
  const toast = useToast();

  const [view, setView] = useState<ViewMode>('board');
  const [filter, setFilter] = useState('');
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const filtered = useMemo(() => entries.filter((e) => matchesFilter(e, filter)), [entries, filter]);

  const scores = useMemo(() => {
    if (!activeResume) return {};
    const profile = resumeProfile(activeResume);
    const out: Record<string, number> = {};
    for (const entry of entries) {
      out[entry.job.id] = scoreJobMatch(profile, entry.job).score;
    }
    return out;
  }, [activeResume, entries]);

  const counts = useMemo(() => groupByStatus(entries), [entries]);
  const activeCount = entries.filter((e) => e.status !== 'archived' && e.status !== 'rejected').length;
  const overdueCount = entries.filter((e) => isFollowUpOverdue(e.followUpOn)).length;

  const openEntry = openJobId ? entries.find((e) => e.job.id === openJobId) ?? null : null;

  const handleStatusChange = useCallback(
    (jobId: string, status: ApplicationStatus) => {
      const entry = entries.find((e) => e.job.id === jobId);
      setStatus(jobId, status);
      if (entry) {
        toast.push({
          title: `${entry.job.title} → ${APPLICATION_STATUS_LABELS[status]}`,
          tone: 'success',
          durationMs: 2500,
        });
      }
    },
    [entries, setStatus, toast],
  );

  return (
    <div className="tr-page">
      <PageHeader
        title="Application tracker"
        eyebrow="Pipeline"
        description="Every job you saved, from first look to offer. Drag a card or use its status menu."
        badge={
          <span className="tr-count-line">
            <Badge tone="accent" variant="soft">
              {entries.length} tracked
            </Badge>
            <Badge tone="neutral" variant="outline">
              {activeCount} active
            </Badge>
            {overdueCount > 0 && (
              <Badge tone="danger" variant="soft" dot>
                {overdueCount} follow-up{overdueCount === 1 ? '' : 's'} overdue
              </Badge>
            )}
          </span>
        }
        actions={
          <Link className="tr-detail-link" to="/jobs">
            <Search size={15} aria-hidden="true" />
            Find more jobs
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={20} />}
          title="No applications tracked yet"
          description="Save a job from the job finder and it lands here, with your match score, notes and follow-up date."
          actions={
            <Link className="tr-tailor-link" to="/jobs">
              Find jobs
            </Link>
          }
        />
      ) : (
        <>
          <div className="tr-toolbar">
            <div className="tr-search">
              <label className="visually-hidden" htmlFor="tr-filter">
                Search tracked applications
              </label>
              <Input
                id="tr-filter"
                type="search"
                value={filter}
                placeholder="Filter by role, company, note…"
                leftIcon={<Search size={15} />}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="tr-segmented" role="group" aria-label="Tracker view">
              <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
                <KanbanSquare size={14} aria-hidden="true" />
                Board
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <Rows3 size={14} aria-hidden="true" />
                List
              </button>
            </div>

            <p className="small muted" aria-live="polite">
              {filter.trim()
                ? `${filtered.length} of ${entries.length} shown`
                : APPLICATION_STATUSES.filter((s) => counts[s].length > 0)
                    .map((s) => `${counts[s].length} ${APPLICATION_STATUS_LABELS[s].toLowerCase()}`)
                    .join(' · ')}
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Search size={18} />}
              title="Nothing matches that filter"
              description="Try a shorter search — it looks at role, company, location, tags and your notes."
              actions={
                <Button variant="secondary" onClick={() => setFilter('')}>
                  Clear filter
                </Button>
              }
            />
          ) : view === 'board' ? (
            <Board
              entries={filtered}
              scores={scores}
              hasResume={Boolean(activeResume)}
              onOpen={setOpenJobId}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <ListView
              entries={filtered}
              scores={scores}
              hasResume={Boolean(activeResume)}
              onOpen={setOpenJobId}
              onStatusChange={handleStatusChange}
            />
          )}
        </>
      )}

      <TrackedDetail
        entry={openEntry}
        open={openEntry !== null}
        onClose={() => setOpenJobId(null)}
        matchScore={openEntry && activeResume ? scores[openEntry.job.id] ?? 0 : null}
      />
    </div>
  );
}
