// @vitest-environment jsdom
/** Colorways: the picker in Settings writes <html data-colorway>; Ink & Brass is the bare default. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui';
import { AppearancePanel } from '@/components/settings/AppearancePanel';
import { COLORWAYS, useSettingsStore } from '@/stores/settingsStore';

afterEach(() => {
  cleanup();
  useSettingsStore.setState({ colorway: 'ink-brass' });
  document.documentElement.removeAttribute('data-colorway');
});

describe('colorway picker', () => {
  it('offers all five and applies the choice to the page', () => {
    render(
      <ToastProvider>
        <AppearancePanel />
      </ToastProvider>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(COLORWAYS.length);
    fireEvent.click(screen.getByLabelText('Hunter & Antique Gold'));
    expect(useSettingsStore.getState().colorway).toBe('hunter');
    expect(document.documentElement.getAttribute('data-colorway')).toBe('hunter');
    fireEvent.click(screen.getByLabelText('Ink & Brass'));
    expect(document.documentElement.hasAttribute('data-colorway')).toBe(false);
  });

  it('refuses an unknown colorway', () => {
    useSettingsStore.getState().setColorway('neon' as never);
    expect(useSettingsStore.getState().colorway).toBe('ink-brass');
  });
});
