import { useState } from 'react';
import { ClipboardPaste, History, ListChecks } from 'lucide-react';
import type { Job } from '@shared/types';
import { APPLICATION_STATUS_LABELS } from '@shared/types';
import { Badge, Card, EmptyState, Field, Input, Tab, TabList, TabPanel, Tabs, Textarea, cx } from '@/components/ui';
import { useJobStore, useTrackedJobs } from '@/stores/jobStore';

export interface PasteState {
  text: string;
  title: string;
  company: string;
}

export interface JobPickerProps {
  /** 'job' when a real posting is selected, 'paste' when the pasted description is in play. */
  mode: 'job' | 'paste';
  selectedJobId: string | null;
  paste: PasteState;
  onSelectJob: (job: Job) => void;
  onPasteChange: (patch: Partial<PasteState>) => void;
  onUsePaste: () => void;
}

/** Pick what to tailor against: a tracked application, a job from the last search, or pasted text. */
export function JobPicker({ mode, selectedJobId, paste, onSelectJob, onPasteChange, onUsePaste }: JobPickerProps) {
  const tracked = useTrackedJobs();
  const results = useJobStore((s) => s.results);
  const recent = results?.jobs ?? [];
  const [tab, setTab] = useState(() => (mode === 'paste' ? 'paste' : 'tracked'));

  const handleTab = (value: string) => {
    setTab(value);
    if (value === 'paste') onUsePaste();
  };

  return (
    <Card title="Job to tailor for" padding="sm">
      <Tabs value={tab} onValueChange={handleTab}>
        <TabList aria-label="Choose a job" variant="pills">
          <Tab value="tracked" icon={<ListChecks size={14} />} count={tracked.length}>
            Tracked
          </Tab>
          <Tab value="recent" icon={<History size={14} />} count={recent.length}>
            Recent
          </Tab>
          <Tab value="paste" icon={<ClipboardPaste size={14} />}>
            Paste
          </Tab>
        </TabList>

        <TabPanel value="tracked">
          {tracked.length === 0 ? (
            <EmptyState
              plain
              size="sm"
              title="No tracked applications"
              description="Save a job from the job finder, or paste a description instead."
            />
          ) : (
            <ul className="tl-joblist">
              {tracked.map((entry) => (
                <li key={entry.job.id}>
                  <button
                    type="button"
                    className={cx('tl-jobitem', mode === 'job' && selectedJobId === entry.job.id && 'tl-jobitem-on')}
                    aria-pressed={mode === 'job' && selectedJobId === entry.job.id}
                    onClick={() => onSelectJob(entry.job)}
                  >
                    <span className="tl-jobitem-title">{entry.job.title}</span>
                    <span className="tl-jobitem-sub">
                      {entry.job.company || 'Unknown company'}
                      <Badge tone="neutral" variant="outline" size="sm">
                        {APPLICATION_STATUS_LABELS[entry.status]}
                      </Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        <TabPanel value="recent">
          {recent.length === 0 ? (
            <EmptyState
              plain
              size="sm"
              title="No recent search"
              description="Run a search on the job finder and the results show up here."
            />
          ) : (
            <ul className="tl-joblist">
              {recent.slice(0, 40).map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    className={cx('tl-jobitem', mode === 'job' && selectedJobId === job.id && 'tl-jobitem-on')}
                    aria-pressed={mode === 'job' && selectedJobId === job.id}
                    onClick={() => onSelectJob(job)}
                  >
                    <span className="tl-jobitem-title">{job.title}</span>
                    <span className="tl-jobitem-sub">
                      {job.company || 'Unknown company'}
                      {job.remote && (
                        <Badge tone="info" variant="soft" size="sm">
                          Remote
                        </Badge>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        <TabPanel value="paste">
          <div className="stack-2">
            <Field label="Job title">
              <Input
                value={paste.title}
                placeholder="Marketing Operations Manager"
                onChange={(e) => onPasteChange({ title: e.target.value })}
              />
            </Field>
            <Field label="Company">
              <Input value={paste.company} placeholder="Acme Corp" onChange={(e) => onPasteChange({ company: e.target.value })} />
            </Field>
            <Field label="Paste a job description" hint="Everything below updates as you type. Nothing leaves your browser.">
              <Textarea
                rows={10}
                value={paste.text}
                placeholder="Paste the full posting here — requirements, responsibilities, the lot."
                onChange={(e) => onPasteChange({ text: e.target.value })}
              />
            </Field>
          </div>
        </TabPanel>
      </Tabs>
    </Card>
  );
}
