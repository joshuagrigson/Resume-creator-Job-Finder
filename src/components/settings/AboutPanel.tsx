import { BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import './settings.css';

export const REPO_URL = 'https://github.com/joshuagrigson/Resume-creator-Job-Finder';

export interface AboutPanelProps {
  className?: string;
}

function uptimeLabel(seconds: number | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'unknown';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours / 24)} days`;
}

/** Version, privacy summary and the links people actually look for. */
export function AboutPanel({ className }: AboutPanelProps) {
  const health = useSettingsStore((s) => s.health);
  const healthError = useSettingsStore((s) => s.healthError);

  return (
    <Card className={className} title="About Launchpad" subtitle="Resume builder + job finder, local-first.">
      <dl className="set-about">
        <dt>Server version</dt>
        <dd>{health?.version ?? (healthError ? 'unavailable — server offline' : 'checking…')}</dd>
        <dt>Server uptime</dt>
        <dd>{health ? uptimeLabel(health.uptimeSeconds) : '—'}</dd>
        <dt>Storage</dt>
        <dd>This browser only (localStorage)</dd>
      </dl>

      <p className="set-note" style={{ marginTop: 'var(--space-4)' }}>
        <ShieldCheck size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
        Match scoring and the ATS report run in your browser. The server only aggregates public job boards and, when a
        key is configured, relays AI requests.
      </p>

      <div className="set-links">
        <a className="row small" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <BookOpen size={14} aria-hidden="true" />
          Source and README
          <ExternalLink size={12} aria-hidden="true" />
        </a>
        <a className="row small" href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
          Report an issue
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}

export default AboutPanel;
