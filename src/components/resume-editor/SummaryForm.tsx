/** Professional summary: one textarea, a live word count, and an optional AI draft. */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { ResumeId } from '@shared/types';
import { Button, Field, Popover, SkeletonText, Textarea, useToast } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useResumeStore } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DictateButton, usePolish } from './Polish';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

const IDEAL = { min: 30, max: 90 };

export interface SummaryFormProps {
  resumeId: ResumeId;
}

export function SummaryForm({ resumeId }: SummaryFormProps) {
  const summary = useResumeSlice(resumeId, (r) => r.summary);
  const update = useResumeUpdate(resumeId);
  const setSummary = (text: string) => update((r) => ({ ...r, summary: text }));
  const polish = usePolish({ value: summary ?? '', kind: 'summary', label: 'Summary', onApply: setSummary });

  if (summary === undefined) return null;

  const words = summary.trim() ? summary.trim().split(/\s+/).length : 0;
  const hint =
    words === 0
      ? `Aim for ${IDEAL.min}–${IDEAL.max} words: your role, your years of experience, and one measurable win.`
      : words < IDEAL.min
        ? `${words} words — a little short. Add a measurable result.`
        : words > IDEAL.max
          ? `${words} words — trim it to ${IDEAL.max} or fewer so recruiters read it all.`
          : `${words} words — good length.`;

  return (
    <div className="stack-4">
      <Field label="Summary" hint={hint}>
        <Textarea spellFix
          rows={5}
          autoResize
          value={summary}
          placeholder="Marketing operations leader with 8+ years building pipelines that turn leads into booked appointments…"
          onChange={(e) => setSummary(e.target.value)}
          onFocus={polish.onFocus}
          onBlur={polish.onBlur}
        />
      </Field>
      {polish.card}
      <div className="re-summary__tools">
        <DictateButton value={summary} onChange={setSummary} label="Talk instead of type" />
        <SummaryAiButton resumeId={resumeId} onApply={setSummary} />
      </div>
    </div>
  );
}

function SummaryAiButton({ resumeId, onApply }: { resumeId: ResumeId; onApply: (text: string) => void }) {
  const aiEnabled = useSettingsStore((s) => s.ai?.enabled ?? false);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);

  if (!aiEnabled) return null;

  const run = async () => {
    const resume = useResumeStore.getState().resumes[resumeId];
    if (!resume) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.ai.summary({ resume });
      const all = [res.summary, ...(res.alternatives ?? [])].filter((s) => typeof s === 'string' && s.trim());
      setOptions(all);
      if (!all.length) setError('The assistant did not return a summary. Try again.');
    } catch (e) {
      const message = e instanceof ApiClientError ? e.message : 'Could not reach the AI service.';
      setError(message);
      toast.push({ title: 'Could not draft a summary', description: message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !loading && options.length === 0) void run();
      }}
      align="start"
      label="AI summary drafts"
      className="re-aipop"
      trigger={
        <Button size="sm" variant="ghost" leftIcon={<Sparkles size={14} />}>
          Draft with AI
        </Button>
      }
    >
      {(close) => (
        <div className="re-aipop__body stack-2">
          <p className="small strong">Suggested summaries</p>
          {loading ? <SkeletonText lines={4} label="Drafting a summary" /> : null}
          {!loading && error ? (
            <div className="stack-2">
              <p className="small" role="alert">
                {error}
              </p>
              <Button size="sm" onClick={() => void run()}>
                Try again
              </Button>
            </div>
          ) : null}
          {!loading && !error && options.length > 0 ? (
            <ul className="re-aipop__list">
              {options.map((option, i) => (
                <li key={i} className="re-aipop__item">
                  <p className="small">{option}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onApply(option);
                      toast.push({ title: 'Summary updated', tone: 'success' });
                      close();
                    }}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Popover>
  );
}
