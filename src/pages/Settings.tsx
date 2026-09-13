/**
 * Settings — appearance, server capabilities (AI + job boards), local data management, about.
 * Nothing here stores a secret in the browser: keys are server-side only.
 */
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, PageHeader } from '@/components/ui';
import { TopBarActions } from '@/components/layout';
import { AboutPanel, AiPanel, AppearancePanel, DataPanel, SourcesPanel } from '@/components/settings';
import '@/components/settings/settings.css';
import { useSettingsStore } from '@/stores/settingsStore';

export default function SettingsPage() {
  const refreshHealth = useSettingsStore((s) => s.refreshHealth);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshHealth();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="set-page">
      <TopBarActions>
        <Button size="sm" leftIcon={<RefreshCw size={15} />} loading={refreshing} onClick={() => void refresh()}>
          Refresh status
        </Button>
      </TopBarActions>

      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Appearance, what the server can do for you, and the data stored in this browser."
      />

      <div className="set-panels">
        <AppearancePanel />
        <AiPanel />
        <SourcesPanel className="set-panels__wide" />
        <DataPanel className="set-panels__wide" />
        <AboutPanel className="set-panels__wide" />
      </div>
    </div>
  );
}
