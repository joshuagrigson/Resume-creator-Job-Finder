import { Monitor, Moon, Sun } from 'lucide-react';
import { Badge, Card, Field, Select } from '@/components/ui';
import { useTheme } from '@/hooks';
import { COLORWAYS, useSettingsStore, type ThemeMode } from '@/stores/settingsStore';
import './settings.css';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Match my system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export interface AppearancePanelProps {
  className?: string;
}

/** Theme selection. `useTheme()` writes `<html data-theme>` and follows the OS while on "system". */
export function AppearancePanel({ className }: AppearancePanelProps) {
  const { mode, resolved, setMode } = useTheme();
  const colorway = useSettingsStore((s) => s.colorway);
  const setColorway = useSettingsStore((s) => s.setColorway);
  const Icon = resolved === 'dark' ? Moon : Sun;

  return (
    <Card
      className={className}
      title="Appearance"
      subtitle="Applies immediately and is remembered on this device."
      actions={
        <Badge tone="neutral" variant="outline" leftIcon={<Icon size={13} aria-hidden="true" />}>
          {resolved === 'dark' ? 'Dark' : 'Light'}
        </Badge>
      }
    >
      <div className="set-row">
        <div className="set-row__text">
          <p className="set-note">
            <strong>Theme.</strong> “Match my system” follows your OS setting and switches with it, including at
            sunset on machines that schedule it.
          </p>
        </div>
        <div className="set-row__control">
          <Field label="Theme" htmlFor="set-theme">
            <Select
              id="set-theme"
              value={mode}
              options={THEME_OPTIONS}
              onChange={(e) => setMode(e.target.value as ThemeMode)}
            />
          </Field>
        </div>
      </div>

      <fieldset className="set-colorways">
        <legend className="set-colorways__legend">Colorway</legend>
        <div className="set-colorways__grid" role="radiogroup" aria-label="Colorway">
          {COLORWAYS.map((c) => (
            <label key={c.value} className="set-colorway" data-selected={colorway === c.value || undefined}>
              <input
                type="radio"
                name="colorway"
                value={c.value}
                checked={colorway === c.value}
                onChange={() => setColorway(c.value)}
              />
              <span className="set-colorway__swatch" aria-hidden="true">
                <span style={{ background: c.accent }} />
                <span style={{ background: c.metal }} />
              </span>
              <span className="set-colorway__name">{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="set-note" style={{ marginTop: 'var(--space-4)' }}>
        <Monitor size={13} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
        Resume previews and printed pages always use the light paper styling, whichever theme you pick.
      </p>
    </Card>
  );
}

export default AppearancePanel;
