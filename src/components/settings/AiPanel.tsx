import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import './settings.css';

export interface AiPanelProps {
  className?: string;
}

/**
 * AI capability status. The key lives on the server only — this panel explains how to set it
 * and never asks for one in the browser.
 */
export function AiPanel({ className }: AiPanelProps) {
  const ai = useSettingsStore((s) => s.ai);
  const health = useSettingsStore((s) => s.health);
  const healthError = useSettingsStore((s) => s.healthError);
  const refreshHealth = useSettingsStore((s) => s.refreshHealth);
  const [checking, setChecking] = useState(false);

  async function recheck() {
    setChecking(true);
    try {
      await refreshHealth();
    } finally {
      setChecking(false);
    }
  }

  const unreachable = Boolean(healthError) && !health;
  const enabled = Boolean(ai?.enabled);
  const reason = ai?.reason ?? healthError ?? 'The server has not reported an AI status yet.';

  return (
    <Card
      className={className}
      title="AI assistance"
      subtitle="Optional. Everything in Launchpad works without it."
      actions={
        <Button size="sm" leftIcon={<RefreshCw size={14} />} loading={checking} onClick={() => void recheck()}>
          Re-check
        </Button>
      }
    >
      <div className="set-status">
        <Sparkles size={18} aria-hidden="true" />
        <div className="set-status__text">
          <p className="set-note">
            {enabled ? (
              <>
                <strong>AI features are on.</strong> Bullet rewrites, summaries, tailoring suggestions, cover letters
                and AI resume import are available.
              </>
            ) : unreachable ? (
              <>
                <strong>The API server is not responding.</strong> Start it with <code>npm run dev:server</code> — job
                search needs it too.
              </>
            ) : (
              <>
                <strong>AI features are off.</strong> {reason}
              </>
            )}
          </p>
        </div>
        <Badge tone={enabled ? 'success' : unreachable ? 'danger' : 'warning'} variant="soft" dot>
          {enabled ? 'Enabled' : unreachable ? 'Server offline' : 'Not configured'}
        </Badge>
      </div>

      {enabled ? (
        <p className="set-note" style={{ marginTop: 'var(--space-4)' }}>
          Model: <code>{ai?.model ?? 'server default'}</code>. Requests are sent from the server, so the only resume
          text that leaves your browser is what an AI action needs.
        </p>
      ) : (
        <>
          <p className="set-note" style={{ marginTop: 'var(--space-4)' }}>
            <strong>How to enable it</strong>
          </p>
          <ol className="set-howto">
            <li>
              Set <code>ANTHROPIC_API_KEY</code> in the server environment (<code>.env</code> locally, or the service
              environment when deployed).
            </li>
            <li>
              Optionally set <code>ANTHROPIC_MODEL</code> to override the default model.
            </li>
            <li>Restart the API server, then press “Re-check”.</li>
          </ol>
          <p className="set-note" style={{ marginTop: 'var(--space-3)' }}>
            The key is only ever read on the server. Launchpad will never ask you to paste one into this page.
          </p>
        </>
      )}
    </Card>
  );
}

export default AiPanel;
