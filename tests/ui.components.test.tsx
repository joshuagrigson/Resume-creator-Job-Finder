// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Chip,
  Field,
  Input,
  Modal,
  ProgressRing,
  ScoreRing,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ToastProvider,
  cx,
  scoreLabel,
  scoreTone,
  useToast,
} from '@/components/ui';

afterEach(cleanup);

describe('cx', () => {
  it('keeps only non-empty strings', () => {
    expect(cx('a', false, undefined, '', 'b', 0, null)).toBe('a b');
  });
});

describe('Button', () => {
  it('renders its label and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save resume</Button>);
    const btn = screen.getByRole('button', { name: 'Save resume' });
    expect(btn.getAttribute('type')).toBe('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is busy and disabled while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading variant="primary" onClick={onClick}>
        Exporting
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Exporting' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.className).toContain('ui-btn--primary');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Modal', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    return (
      <Modal open onClose={onClose} title="Import resume" description="Paste text or upload JSON.">
        <button type="button">Inner action</button>
      </Modal>
    );
  }

  it('renders as a labelled modal dialog and moves focus inside', async () => {
    render(<Harness onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Import resume')).toBeTruthy();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not the panel', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    void container;
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Tabs', () => {
  function Harness() {
    return (
      <Tabs defaultValue="editor">
        <TabList aria-label="Resume builder">
          <Tab value="editor">Editor</Tab>
          <Tab value="preview">Preview</Tab>
          <Tab value="ats">ATS</Tab>
        </TabList>
        <TabPanel value="editor">Editor panel</TabPanel>
        <TabPanel value="preview">Preview panel</TabPanel>
        <TabPanel value="ats">ATS panel</TabPanel>
      </Tabs>
    );
  }

  it('selects the default tab and wires aria attributes', () => {
    render(<Harness />);
    const editor = screen.getByRole('tab', { name: 'Editor' });
    expect(editor.getAttribute('aria-selected')).toBe('true');
    expect(editor.getAttribute('tabindex')).toBe('0');
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(editor.id);
    expect(screen.getByText('Editor panel')).toBeTruthy();
  });

  it('moves between tabs with arrow keys and wraps around', () => {
    render(<Harness />);
    const tablist = screen.getByRole('tablist');
    const [editor, preview, ats] = screen.getAllByRole('tab');

    editor!.focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(preview!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Preview panel')).toBeTruthy();

    fireEvent.keyDown(tablist, { key: 'End' });
    expect(ats!.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(editor!.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(ats!.getAttribute('aria-selected')).toBe('true');
  });

  it('selects on click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'ATS' }));
    expect(screen.getByText('ATS panel')).toBeTruthy();
  });
});

describe('Toast', () => {
  function Pusher() {
    const toast = useToast();
    return (
      <button
        type="button"
        onClick={() => toast.push({ title: 'Resume saved', description: 'All changes stored locally.', tone: 'success' })}
      >
        Save
      </button>
    );
  }

  it('renders a pushed toast and dismisses it', async () => {
    render(
      <ToastProvider>
        <Pusher />
      </ToastProvider>,
    );
    expect(screen.queryByText('Resume saved')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Resume saved')).toBeTruthy();
    expect(screen.getByText('All changes stored locally.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    await waitFor(() => expect(screen.queryByText('Resume saved')).toBeNull());
  });

  it('announces errors assertively', () => {
    function ErrorPusher() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.push({ title: 'Search failed', tone: 'error' })}>
          Go
        </button>
      );
    }
    render(
      <ToastProvider>
        <ErrorPusher />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('Search failed');
  });
});

describe('form controls', () => {
  it('Field wires label, hint and error to the input', () => {
    const { rerender } = render(
      <Field label="Email" hint="Shown on your resume">
        <Input defaultValue="" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Shown on your resume').id);

    rerender(
      <Field label="Email" hint="Shown on your resume" error="Enter a valid email">
        <Input defaultValue="" />
      </Field>,
    );
    const invalid = screen.getByLabelText('Email');
    expect(invalid.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Enter a valid email');
  });

  it('Switch toggles and exposes aria-checked', () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} label="Remote only" />;
    }
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Remote only' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('Checkbox supports the indeterminate state', () => {
    render(<Checkbox label="All sources" indeterminate />);
    const box = screen.getByLabelText('All sources') as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
  });

  it('Chip toggles and removes', () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    render(
      <>
        <Chip selected onToggle={onToggle}>
          Remote
        </Chip>
        <Chip onRemove={onRemove}>HubSpot</Chip>
      </>,
    );
    const toggle = screen.getByRole('button', { name: 'Remote' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remove HubSpot' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('score helpers', () => {
  it('maps scores to labels and tones', () => {
    expect(scoreLabel(92)).toBe('Excellent');
    expect(scoreLabel(72)).toBe('Strong');
    expect(scoreLabel(60)).toBe('Good');
    expect(scoreLabel(45)).toBe('Fair');
    expect(scoreLabel(10)).toBe('Low');
    expect(scoreTone(90)).toBe('success');
    expect(scoreTone(60)).toBe('info');
    expect(scoreTone(45)).toBe('warning');
    expect(scoreTone(5)).toBe('danger');
  });

  it('clamps ring values and names them for screen readers', () => {
    render(<ProgressRing value={140} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('100 out of 100');
    cleanup();

    render(<ScoreRing name="ATS score" value={-5} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('ATS score: 0 out of 100 — Low');
  });
});

describe('Badge', () => {
  it('carries tone classes and text', () => {
    render(
      <Badge tone="success" dot>
        Applied
      </Badge>,
    );
    const badge = screen.getByText('Applied');
    expect(badge.className).toContain('ui-badge--success');
    expect(badge.textContent).toBe('Applied');
  });
});
