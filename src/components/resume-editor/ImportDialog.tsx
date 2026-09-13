/**
 * Import a resume: a JSON file we (or jsonresume.org) exported, or pasted plain text parsed
 * with the built-in heuristics — or, when the server has AI, with the model.
 *
 * Importing always creates a *new* resume so nothing already in the app is overwritten.
 */
import { useRef, useState } from 'react';
import { FileJson, FileUp, Sparkles, Wand2 } from 'lucide-react';
import type { Resume, ResumeId } from '@shared/types';
import { Button, Modal, Tab, TabList, TabPanel, Tabs, Textarea, useToast } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { createBlankResume } from '@/lib/resume/defaults';
import { parseResumeText } from '@/lib/resume/parse-text';
import { normalizeImportedResume } from '@/lib/resume/validate';
import { useResumeStore } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new resume id after a successful import. */
  onImported?: (id: ResumeId) => void;
}

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const addResume = useResumeStore((s) => s.addResume);
  const aiEnabled = useSettingsStore((s) => s.ai?.enabled ?? false);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState<null | 'file' | 'text' | 'ai'>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const reset = () => {
    setText('');
    setBusy(null);
    setError(null);
    setWarnings([]);
  };

  const finish = (candidate: unknown, fallbackName: string) => {
    const result = normalizeImportedResume(candidate);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const resume: Resume = { ...result.resume, name: result.resume.name?.trim() || fallbackName };
    const id = addResume(resume);
    setWarnings(result.warnings);
    toast.push({
      title: 'Resume imported',
      description: result.warnings.length ? `${result.warnings.length} field(s) needed cleanup.` : undefined,
      tone: 'success',
    });
    onImported?.(id);
    reset();
    onClose();
  };

  const importFile = async (file: File) => {
    setBusy('file');
    setError(null);
    try {
      const raw = await file.text();
      finish(raw, file.name.replace(/\.json$/i, '') || 'Imported resume');
    } catch {
      setError('That file could not be read. Make sure it is a .json file.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const importText = () => {
    if (!text.trim()) {
      setError('Paste your resume text first.');
      return;
    }
    setBusy('text');
    setError(null);
    try {
      const parsed = parseResumeText(text);
      const base = createBlankResume('Imported resume');
      finish({ ...base, ...parsed, name: nameFrom(parsed) ?? 'Imported resume' }, 'Imported resume');
    } catch {
      setError('That text could not be parsed. Try the JSON import instead.');
    } finally {
      setBusy(null);
    }
  };

  const importWithAi = async () => {
    if (!text.trim()) {
      setError('Paste your resume text first.');
      return;
    }
    setBusy('ai');
    setError(null);
    try {
      const res = await api.ai.parseResume({ text });
      const base = createBlankResume('Imported resume');
      const aiName = res.resume?.contact?.fullName?.trim();
      finish({ ...base, ...res.resume, name: aiName ? `${aiName} — imported` : 'Imported resume' }, 'Imported resume');
    } catch (e) {
      const message = e instanceof ApiClientError ? e.message : 'Could not reach the AI service.';
      setError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import a resume"
      description="Bring in a JSON export or paste the text of an existing resume."
      size="lg"
    >
      <Tabs defaultValue="paste">
        <TabList aria-label="Import method" variant="pills">
          <Tab value="paste" icon={<Wand2 size={14} />}>
            Paste text
          </Tab>
          <Tab value="file" icon={<FileJson size={14} />}>
            JSON file
          </Tab>
        </TabList>

        <TabPanel value="paste">
          <div className="stack-4 re-import">
            <label className="re-import__label" htmlFor="re-import-text">
              Resume text
            </label>
            <Textarea
              id="re-import-text"
              rows={10}
              value={text}
              placeholder={'Paste everything from your current resume — headings, dates, bullets.'}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="row row-wrap">
              <Button variant="primary" loading={busy === 'text'} onClick={importText}>
                Parse text
              </Button>
              {aiEnabled ? (
                <Button
                  variant="secondary"
                  leftIcon={<Sparkles size={15} />}
                  loading={busy === 'ai'}
                  onClick={() => void importWithAi()}
                >
                  Parse with AI
                </Button>
              ) : null}
            </div>
            <p className="subtle small">
              The built-in parser reads headings, date ranges and bullets. Anything it misses is easy to fix in the
              editor.
            </p>
          </div>
        </TabPanel>

        <TabPanel value="file">
          <div className="stack-4 re-import">
            <input
              ref={fileRef}
              id="re-import-file"
              className="re-import__file"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
              }}
            />
            <label className="re-import__drop" htmlFor="re-import-file">
              <FileUp size={20} aria-hidden="true" />
              <span className="strong">Choose a .json file</span>
              <span className="subtle small">Launchpad exports and JSON Resume files both work.</span>
            </label>
            {busy === 'file' ? <p className="small muted">Reading file…</p> : null}
          </div>
        </TabPanel>
      </Tabs>

      {error ? (
        <p className="re-import__error" role="alert">
          {error}
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="re-import__warnings">
          {warnings.map((warning, i) => (
            <li key={i} className="small muted">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}

function nameFrom(parsed: Partial<Resume>): string | undefined {
  const full = parsed.contact?.fullName?.trim();
  return full ? `${full} — imported` : undefined;
}
