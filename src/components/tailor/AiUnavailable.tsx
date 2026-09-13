import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';

export interface AiUnavailableProps {
  /** What the user was trying to do, e.g. "Tailoring suggestions". */
  feature: string;
}

/** Shown in place of an AI panel when the server has no key (or is unreachable). */
export function AiUnavailable({ feature }: AiUnavailableProps) {
  const ai = useSettingsStore((s) => s.ai);
  const reason = ai?.reason?.trim();

  return (
    <EmptyState
      icon={<Sparkles size={20} />}
      title={`${feature} need the AI server`}
      description={
        <>
          <span>
            {reason ? `${reason}. ` : 'The API server has no Anthropic key. '}
            Set <code>ANTHROPIC_API_KEY</code> in the server environment and restart it (
            <code>npm run dev:server</code>) to switch these on.
          </span>
          <br />
          <span>
            Everything else on this page — keyword gap, ATS scoring, match score — is computed in your browser and works without
            it.
          </span>
        </>
      }
      actions={
        <Link className="tl-linkbtn" to="/settings">
          Check AI status in Settings
        </Link>
      }
    />
  );
}
