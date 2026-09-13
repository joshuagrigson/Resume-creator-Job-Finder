import { Globe } from 'lucide-react';
import type { JobSource } from '@shared/types';
import { JOB_SOURCE_LABELS, JOB_SOURCES } from '@shared/types';
import { Badge, Card, SkeletonText } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import './settings.css';

export interface SourcesPanelProps {
  className?: string;
}

interface SourceNote {
  /** What this board is good for. */
  about: string;
  /** One line explaining how to turn it on. Only for key-gated sources. */
  enable?: string;
}

const SOURCE_NOTES: Record<JobSource, SourceNote> = {
  remotive: { about: 'Remote roles, mostly tech and product.' },
  remoteok: { about: 'Remote job board with salary data on many posts.' },
  arbeitnow: { about: 'European postings, strong in Germany.' },
  themuse: { about: 'Company-branded listings across the US.' },
  jobicy: { about: 'Remote roles filtered by region and tag.' },
  himalayas: { about: 'Remote-first companies, rich descriptions.' },
  adzuna: {
    about: 'Broad national coverage (US, UK, CA, AU, DE and more).',
    enable: 'Set ADZUNA_APP_ID and ADZUNA_APP_KEY on the server — free keys at developer.adzuna.com.',
  },
  usajobs: {
    about: 'US federal government vacancies.',
    enable: 'Set USAJOBS_API_KEY and USAJOBS_USER_AGENT on the server — free key at developer.usajobs.gov.',
  },
};

/** Which boards the API server will query, and what it takes to switch the rest on. */
export function SourcesPanel({ className }: SourcesPanelProps) {
  const health = useSettingsStore((s) => s.health);
  const healthError = useSettingsStore((s) => s.healthError);

  const sources = health?.sources;
  const enabledCount = sources?.filter((s) => s.enabled).length ?? 0;

  return (
    <Card
      className={className}
      title="Job sources"
      subtitle={
        sources
          ? `${enabledCount} of ${sources.length} boards active`
          : 'Reported by the API server at /api/health'
      }
      actions={<Globe size={18} aria-hidden="true" className="subtle" />}
    >
      {!sources ? (
        healthError ? (
          <div className="set-status">
            <div className="set-status__text">
              <p className="set-note">
                <strong>Could not reach the API server.</strong> {healthError}. Job search and source status need it —
                start it with <code>npm run dev:server</code>.
              </p>
            </div>
            <Badge tone="danger" variant="soft" dot>
              Offline
            </Badge>
          </div>
        ) : (
          <SkeletonText lines={4} label="Loading job source status" />
        )
      ) : (
        <ul className="set-sources">
          {sources.map((entry) => {
            const note = SOURCE_NOTES[entry.source] ?? { about: 'Job board.' };
            const label = JOB_SOURCE_LABELS[entry.source] ?? entry.source;
            return (
              <li className="set-source" key={entry.source}>
                <div className="set-source__main">
                  <div className="set-source__name">{label}</div>
                  <p className="set-source__hint">
                    {note.about}
                    {!entry.enabled && entry.needsKey && note.enable ? ` ${note.enable}` : ''}
                  </p>
                </div>
                <Badge tone={entry.enabled ? 'success' : 'neutral'} variant="soft" dot>
                  {entry.enabled ? 'Active' : entry.needsKey ? 'Needs a key' : 'Off'}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      <p className="set-note" style={{ marginTop: 'var(--space-4)' }}>
        Keyless boards are always on. The two key-gated boards are optional — everything else still returns results
        without them. Keys are read on the server only.
      </p>
      <p className="set-note" style={{ marginTop: 'var(--space-2)' }}>
        Supported sources: {JOB_SOURCES.map((s) => JOB_SOURCE_LABELS[s]).join(', ')}.
      </p>
    </Card>
  );
}

export default SourcesPanel;
