import { useCallback, useState } from 'react';
import { Copy, Download, PenLine, RefreshCw } from 'lucide-react';
import type { AiCoverLetterRequest, Resume } from '@shared/types';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Field, Select, Textarea, useToast } from '@/components/ui';
import { AiUnavailable } from './AiUnavailable';
import { aiErrorCopy } from './helpers';
import { useSettingsStore } from '@/stores/settingsStore';

export interface CoverLetterPanelProps {
  resume: Resume;
  jobText: string;
  jobTitle: string;
  company: string;
}

type Tone = NonNullable<AiCoverLetterRequest['tone']>;

const TONES: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'warm', label: 'Warm' },
  { value: 'direct', label: 'Direct' },
];

const LENGTHS = [
  { value: '180', label: 'Short — about 180 words' },
  { value: '280', label: 'Standard — about 280 words' },
  { value: '400', label: 'Detailed — about 400 words' },
];

function fileNameFor(resume: Resume, company: string): string {
  const who = (resume.contact.fullName || resume.name || 'Cover letter').trim();
  const where = company.trim();
  const base = where ? `${who} — ${where} cover letter` : `${who} cover letter`;
  return `${base.replace(/[\\/:*?"<>|]+/g, '-')}.txt`;
}

/** Generate, edit, copy and download a cover letter for the selected posting. */
export function CoverLetterPanel({ resume, jobText, jobTitle, company }: CoverLetterPanelProps) {
  const aiEnabled = useSettingsStore((s) => s.ai?.enabled === true);
  const toast = useToast();

  const [tone, setTone] = useState<Tone>('professional');
  const [length, setLength] = useState('280');
  const [letter, setLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; description: string; retryable: boolean } | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.ai.coverLetter({
        resume,
        jobText,
        jobTitle: jobTitle || undefined,
        company: company || undefined,
        tone,
        lengthWords: Number(length),
      });
      setLetter(res.letter ?? '');
    } catch (e) {
      const copy = aiErrorCopy(e);
      setError(copy);
      toast.push({ title: copy.title, description: copy.description, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [resume, jobText, jobTitle, company, tone, length, toast]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      toast.push({ title: 'Cover letter copied', tone: 'success', durationMs: 2500 });
    } catch {
      toast.push({ title: 'Could not copy', description: 'Select the text and copy it manually.', tone: 'error' });
    }
  };

  const download = () => {
    const blob = new Blob([letter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileNameFor(resume, company);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (!aiEnabled) return <AiUnavailable feature="Cover letters" />;

  const tooShort = jobText.trim().length < 40;

  return (
    <div className="tl-cover stack-4">
      <Card padding="sm">
        <div className="tl-cover-controls">
          <Field label="Tone" className="grow">
            <Select value={tone} options={TONES} onChange={(e) => setTone(e.target.value as Tone)} />
          </Field>
          <Field label="Length" className="grow">
            <Select value={length} options={LENGTHS} onChange={(e) => setLength(e.target.value)} />
          </Field>
          <Button
            variant="primary"
            leftIcon={letter ? <RefreshCw size={15} /> : <PenLine size={15} />}
            loading={loading}
            disabled={loading || tooShort}
            onClick={() => void generate()}
          >
            {letter ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
        {tooShort && <p className="small muted">Pick or paste a job description first.</p>}
      </Card>

      {loading && (
        <Card padding="sm">
          <p className="tl-ai-loading" role="status">
            <span className="tl-spinner" aria-hidden="true" />
            Drafting your letter — usually 10–30 s.
          </p>
        </Card>
      )}

      {error && !loading && (
        <EmptyState
          icon={<PenLine size={18} />}
          title={error.title}
          description={error.description}
          actions={
            error.retryable ? (
              <Button variant="secondary" leftIcon={<RefreshCw size={15} />} onClick={() => void generate()}>
                Try again
              </Button>
            ) : undefined
          }
        />
      )}

      {letter && !loading && (
        <Card padding="sm">
          <Field label="Your cover letter" hint="Edit freely — this is your draft, not the model's.">
            <Textarea rows={16} value={letter} onChange={(e) => setLetter(e.target.value)} />
          </Field>
          <div className="tl-cover-actions">
            <Button variant="secondary" leftIcon={<Copy size={15} />} onClick={() => void copyToClipboard()}>
              Copy
            </Button>
            <Button variant="secondary" leftIcon={<Download size={15} />} onClick={download}>
              Download .txt
            </Button>
          </div>
        </Card>
      )}

      {!letter && !loading && !error && (
        <EmptyState
          icon={<PenLine size={18} />}
          title="No letter yet"
          description="Generate a first draft from your resume and this posting, then edit it into your own voice."
        />
      )}
    </div>
  );
}
