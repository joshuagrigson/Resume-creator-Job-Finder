import { useId, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { EmploymentType, JobSearchQuery, JobSource } from '@shared/types';
import { JOB_SOURCES } from '@shared/types';
import { Button, Checkbox, Chip, Popover, Select } from '@/components/ui';
import { useIsMobile } from '@/hooks';
import { EMPLOYMENT_TYPE_LABELS, sourceLabel } from './format';
import './jobs.css';

/** Sort mode: `match` is applied client-side against the active resume. */
export type SortMode = 'relevance' | 'date' | 'match';

export interface FiltersBarProps {
  query: JobSearchQuery;
  sort: SortMode;
  /** Sources the server reports as unavailable (missing API key / disabled). */
  unavailableSources?: readonly JobSource[];
  /** True when a resume exists, which is what makes "Best match" meaningful. */
  matchAvailable: boolean;
  onChange: (patch: Partial<JobSearchQuery>) => void;
  onSortChange: (sort: SortMode) => void;
}

const POSTED_OPTIONS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '', label: 'Any time' },
];

const EMPLOYMENT_OPTIONS = [
  { value: '', label: 'Any type' },
  ...(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((value) => ({
    value,
    label: EMPLOYMENT_TYPE_LABELS[value],
  })),
];

/** Filters below the search bar. Collapsed behind a button on phones. */
export function FiltersBar({
  query,
  sort,
  unavailableSources = [],
  matchAvailable,
  onChange,
  onSortChange,
}: FiltersBarProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const selected = query.sources ?? [];
  const unavailable = new Set(unavailableSources);
  const sourceSummary = selected.length === 0 ? 'All boards' : `${selected.length} board${selected.length === 1 ? '' : 's'}`;
  const open = !isMobile || expanded;

  function toggleSource(source: JobSource, on: boolean) {
    const next = on ? [...selected, source] : selected.filter((s) => s !== source);
    onChange({ sources: next });
  }

  return (
    <div className="jf-filters">
      {isMobile ? (
        <Button
          className="jf-filters__toggle"
          size="sm"
          leftIcon={<SlidersHorizontal size={14} />}
          rightIcon={<ChevronDown size={14} />}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide filters' : 'Filters'}
        </Button>
      ) : null}

      {open ? (
        <div className="jf-filters__row" id={panelId} role="group" aria-label="Job filters">
          <div className="jf-filters__control">
            <label className="jf-filters__label" htmlFor="jf-posted">
              Posted
            </label>
            <Select
              id="jf-posted"
              uiSize="sm"
              value={query.postedWithinDays === undefined ? '' : String(query.postedWithinDays)}
              options={POSTED_OPTIONS}
              onChange={(e) => onChange({ postedWithinDays: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="jf-filters__control">
            <label className="jf-filters__label" htmlFor="jf-type">
              Type
            </label>
            <Select
              id="jf-type"
              uiSize="sm"
              value={query.employmentType ?? ''}
              options={EMPLOYMENT_OPTIONS}
              onChange={(e) => onChange({ employmentType: (e.target.value || undefined) as EmploymentType | undefined })}
            />
          </div>

          <Popover
            align="start"
            label="Job boards"
            padded
            trigger={
              <Button size="sm" rightIcon={<ChevronDown size={14} />}>
                {sourceSummary}
              </Button>
            }
          >
            {(close) => (
              <div className="jf-sources">
                <div className="jf-sources__list">
                  {JOB_SOURCES.map((source) => {
                    const disabled = unavailable.has(source);
                    return (
                      <Checkbox
                        key={source}
                        label={sourceLabel(source)}
                        description={disabled ? 'Needs an API key on the server' : undefined}
                        checked={selected.includes(source)}
                        disabled={disabled}
                        onChange={(e) => toggleSource(source, e.target.checked)}
                      />
                    );
                  })}
                </div>
                <div className="jf-sources__actions">
                  <Button size="sm" onClick={() => onChange({ sources: [] })}>
                    All boards
                  </Button>
                  <Button size="sm" variant="ghost" onClick={close}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </Popover>

          <Chip selected={Boolean(query.remoteOnly)} onToggle={(on) => onChange({ remoteOnly: on })}>
            Remote only
          </Chip>

          <div className="jf-filters__spacer" />

          <div className="jf-filters__control">
            <label className="jf-filters__label" htmlFor="jf-sort">
              Sort
            </label>
            <Select
              id="jf-sort"
              uiSize="sm"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortMode)}
            >
              <option value="relevance">Relevance</option>
              <option value="date">Newest</option>
              <option value="match" disabled={!matchAvailable}>
                Best match{matchAvailable ? '' : ' (needs a resume)'}
              </option>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
