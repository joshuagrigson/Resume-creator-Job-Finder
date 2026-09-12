// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell, TopBarActions, navTitleFor, NAV_ITEMS } from '@/components/layout';
import { Button, Drawer, Menu, MenuItem, MenuSeparator, Popover, Tooltip } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';

function stubMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  stubMatchMedia(false);
  // The shell calls refreshHealth() on mount; keep it off the network.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({ ok: true, version: '0.1.0', uptimeSeconds: 1, ai: { enabled: true, model: 'test' }, sources: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );
  useSettingsStore.setState({ theme: 'light', health: null, ai: null, healthError: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

function renderShell(initialPath = '/', children = <p>Page body</p>) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppShell>{children}</AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('renders every nav link in both the sidebar and the mobile tab bar', () => {
    renderShell();
    for (const item of NAV_ITEMS) {
      const links = screen.getAllByRole('link', { name: new RegExp(`^${item.label}$`) });
      expect(links.length).toBeGreaterThanOrEqual(1);
      for (const link of links) expect(link.getAttribute('href')).toBe(item.to);
    }
    // Dashboard uses a short label on the mobile bar.
    expect(screen.getAllByRole('link', { name: 'Home' }).length).toBe(1);
  });

  it('renders the skip link, main landmark and page content', () => {
    renderShell('/jobs');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip.getAttribute('href')).toBe('#main');
    const main = screen.getByRole('main');
    expect(main.id).toBe('main');
    expect(main.textContent).toContain('Page body');
  });

  it('marks the active route', () => {
    renderShell('/tracker');
    const active = document.querySelectorAll('.app-nav__link--active');
    expect(active.length).toBe(1);
    expect(active[0]?.textContent).toContain('Tracker');
  });

  it('applies the resolved theme to <html> and cycles light → dark → system', () => {
    renderShell();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: /switch to system theme/i }));
    expect(useSettingsStore.getState().theme).toBe('system');
    // matchMedia is stubbed to "not dark", so system resolves to light.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('refreshes health once on mount and shows the AI status', async () => {
    renderShell();
    await waitFor(() => expect(useSettingsStore.getState().ai?.enabled).toBe(true));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText('AI features ready').length).toBeGreaterThan(0));
    expect(screen.getByText(/local-first/i).textContent).toContain('your data stays in this browser');
  });

  it('collapses the sidebar on request', () => {
    renderShell();
    expect(document.querySelector('.app-sidebar--collapsed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(document.querySelector('.app-sidebar--collapsed')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(document.querySelector('.app-sidebar--collapsed')).toBeNull();
  });

  it('portals page actions into the top bar', () => {
    renderShell(
      '/resume',
      <TopBarActions>
        <Button variant="primary">Export</Button>
      </TopBarActions>,
    );
    const slot = document.querySelector('.app-topbar__slot');
    expect(slot).not.toBeNull();
    expect(slot?.textContent).toContain('Export');
  });
});

describe('navTitleFor', () => {
  it('resolves nested routes to their section', () => {
    expect(navTitleFor('/')).toBe('Dashboard');
    expect(navTitleFor('/resume')).toBe('Resume');
    expect(navTitleFor('/tailor/remotive:123')).toBe('Tailor');
    expect(navTitleFor('/nope')).toBe('Launchpad');
  });
});

describe('Menu', () => {
  function Harness({ onPick }: { onPick: () => void }) {
    return (
      <Menu trigger={<Button>Actions</Button>} label="Resume actions">
        <MenuItem onSelect={onPick}>Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem danger onSelect={() => {}}>
          Delete
        </MenuItem>
      </Menu>
    );
  }

  it('opens from the trigger, moves with arrow keys and closes on select', async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Resume actions' });
    const items = screen.getAllByRole('menuitem');
    await waitFor(() => expect(document.activeElement).toBe(items[0]));

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.click(items[0]!);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<Harness onPick={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Popover', () => {
  it('toggles and exposes a close callback to its content', () => {
    render(
      <Popover trigger={<Button>Style</Button>} label="Resume style">
        {(close) => (
          <button type="button" onClick={close}>
            Done
          </button>
        )}
      </Popover>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Style' }));
    expect(screen.getByRole('dialog', { name: 'Resume style' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Drawer', () => {
  it('renders a labelled dialog and closes with the close button', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} side="bottom" title="Job details">
        <p>Details body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Job details' });
    expect(dialog.className).toContain('ui-drawer--bottom');
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Tooltip', () => {
  it('shows on focus and describes its trigger', async () => {
    render(
      <Tooltip content="Copy to clipboard" delayMs={0}>
        <button type="button">Copy</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Copy' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(trigger);
    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toBe('Copy to clipboard');
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id);
    fireEvent.blur(trigger);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });
});
