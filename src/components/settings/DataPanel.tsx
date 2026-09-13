import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import type { Resume } from '@shared/types';
import { RESUME_SCHEMA_VERSION } from '@shared/types';
import { normalizeImportedResume } from '@/lib/resume/validate';
import { downloadBlob } from '@/lib/export';
import { Button, Card, Field, Input, Modal, useToast } from '@/components/ui';
import { useJobStore } from '@/stores/jobStore';
import { useResumeStore } from '@/stores/resumeStore';
import './settings.css';

export interface LaunchpadExport {
  app: 'launchpad';
  schemaVersion: number;
  exportedAt: string;
  resumes: Resume[];
}

/** The exact object written by "Export everything" — `normalizeImportedResume` reads it back. */
export function buildExportBundle(resumes: Resume[], now: Date = new Date()): LaunchpadExport {
  return {
    app: 'launchpad',
    schemaVersion: RESUME_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    resumes,
  };
}

export function exportFileName(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `Launchpad resumes ${stamp}.json`;
}

const CONFIRM_WORD = 'DELETE';

export interface DataPanelProps {
  className?: string;
}

/** Backup, restore and the local-data reset. Nothing here touches the network. */
export function DataPanel({ className }: DataPanelProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [importing, setImporting] = useState(false);

  const resumes = useResumeStore((s) => s.resumes);
  const addResume = useResumeStore((s) => s.addResume);
  const resetResumes = useResumeStore((s) => s.reset);
  const tracked = useJobStore((s) => s.tracked);
  const savedSearches = useJobStore((s) => s.savedSearches);
  const resetJobs = useJobStore((s) => s.reset);

  const resumeList = Object.values(resumes);
  const trackedCount = Object.keys(tracked).length;

  function handleExport() {
    if (resumeList.length === 0) {
      toast.push({ title: 'Nothing to export yet', description: 'Create a resume first.', tone: 'info' });
      return;
    }
    try {
      const text = `${JSON.stringify(buildExportBundle(resumeList), null, 2)}\n`;
      downloadBlob(new Blob([text], { type: 'application/json' }), exportFileName());
      toast.push({
        title: `Exported ${resumeList.length} resume${resumeList.length === 1 ? '' : 's'}`,
        tone: 'success',
      });
    } catch (error) {
      toast.push({ title: 'Export failed', description: (error as Error).message, tone: 'error' });
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const result = normalizeImportedResume(text);
      if ('error' in result) {
        toast.push({ title: 'Could not import that file', description: result.error, tone: 'error' });
        return;
      }
      addResume(result.resume);
      toast.push({
        title: `Imported “${result.resume.name}”`,
        description: result.warnings.length > 0 ? result.warnings.join(' ') : 'It is now your active resume.',
        tone: 'success',
      });
    } catch (error) {
      toast.push({ title: 'Could not read that file', description: (error as Error).message, tone: 'error' });
    } finally {
      setImporting(false);
    }
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmText('');
  }

  function handleClearAll() {
    if (confirmText.trim() !== CONFIRM_WORD) return;
    resetResumes();
    resetJobs();
    closeConfirm();
    toast.push({ title: 'All local data cleared', description: 'Resumes, tracked jobs and saved searches are gone.', tone: 'success' });
  }

  const canConfirm = confirmText.trim() === CONFIRM_WORD;

  return (
    <Card
      className={className}
      title="Your data"
      subtitle={`${resumeList.length} resume${resumeList.length === 1 ? '' : 's'} · ${trackedCount} tracked job${trackedCount === 1 ? '' : 's'} · ${savedSearches.length} saved search${savedSearches.length === 1 ? '' : 'es'}`}
    >
      <p className="set-note">
        Everything lives in this browser's local storage — there is no account and no server copy. Export a backup
        before clearing your browser data or moving to another machine.
      </p>

      <div className="set-actions" style={{ marginTop: 'var(--space-4)' }}>
        <Button leftIcon={<Download size={15} />} onClick={handleExport}>
          Export all resumes (JSON)
        </Button>
        <Button leftIcon={<Upload size={15} />} loading={importing} onClick={() => fileRef.current?.click()}>
          Import from JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => void handleImportFile(e)}
          aria-label="Choose a resume JSON file to import"
        />
      </div>

      <p className="set-note" style={{ marginTop: 'var(--space-3)' }}>
        Import accepts a single resume exported from Launchpad, a full export bundle, or a{' '}
        <a href="https://jsonresume.org/" target="_blank" rel="noopener noreferrer">
          JSON Resume
        </a>{' '}
        file. Imported resumes are added alongside your existing ones, never merged over them.
      </p>

      <div className="set-status set-danger" style={{ marginTop: 'var(--space-5)' }}>
        <div className="set-status__text">
          <p className="set-note">
            <strong>Clear all data.</strong> Deletes every resume, tracked application and saved search on this
            device. This cannot be undone.
          </p>
        </div>
        <Button variant="danger" leftIcon={<Trash2 size={15} />} onClick={() => setConfirmOpen(true)}>
          Clear all data
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={closeConfirm}
        title="Clear all local data?"
        description="There is no server backup — once this is done it is done."
        size="sm"
        footer={
          <>
            <Button onClick={closeConfirm}>Cancel</Button>
            <Button variant="danger" disabled={!canConfirm} onClick={handleClearAll}>
              Delete everything
            </Button>
          </>
        }
      >
        <div className="set-confirm">
          <ul className="set-confirm__list">
            <li>
              {resumeList.length} resume{resumeList.length === 1 ? '' : 's'}
            </li>
            <li>
              {trackedCount} tracked application{trackedCount === 1 ? '' : 's'} and their notes
            </li>
            <li>
              {savedSearches.length} saved search{savedSearches.length === 1 ? '' : 'es'}
            </li>
          </ul>
          <Field label={`Type ${CONFIRM_WORD} to confirm`} htmlFor="set-clear-confirm">
            <Input
              id="set-clear-confirm"
              value={confirmText}
              autoComplete="off"
              spellCheck={false}
              placeholder={CONFIRM_WORD}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

export default DataPanel;
