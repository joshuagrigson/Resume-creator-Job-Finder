import { useCallback, useRef, useState } from 'react';
import { Check, RefreshCw, Sparkles, X } from 'lucide-react';
import type { AiTailorSuggestion, Resume } from '@shared/types';
import { api } from '@/lib/api';
import { Badge, Button, Card, EmptyState, Switch, useToast } from '@/components/ui';
import { useResumeStore } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AiUnavailable } from './AiUnavailable';
import { aiErrorCopy, withSkillsAdded } from './helpers';

export interface AiTailorPanelProps {
  resume: Resume;
  jobText: string;
  jobTitle: string;
  company: string;
  /** Set on the tailored copy so the resume remembers what it was written for. */
  jobId: string | null;
}

type Decision = 'accepted' | 'skipped';

const TYPE_LABEL: Record<AiTailorSuggestion['type'], string> = {
  summary: 'Summary',
  headline: 'Headline',
  bullet: 'Bullet',
  skill: 'Skill',
};

/** Apply one suggestion to the resume identified by `id`. */
function applySuggestion(
  suggestion: AiTailorSuggestion,
  update: (id: string, updater: (r: Resume) => Resume) => void,
  id: string,
): boolean {
  const value = suggestion.suggested.trim();
  if (!value) return false;

  switch (suggestion.type) {
    case 'summary':
      update(id, (r) => ({ ...r, summary: value }));
      return true;
    case 'headline':
      update(id, (r) => ({ ...r, contact: { ...r.contact, headline: value } }));
      return true;
    case 'skill':
      update(id, (r) => withSkillsAdded(r, [value]));
      return true;
    case 'bullet': {
      let applied = false;
      update(id, (r) => {
        const index = r.experience.findIndex((e) => e.id === suggestion.experienceId);
        const bulletIndex = suggestion.bulletIndex ?? -1;
        if (index === -1) return r;
        const item = r.experience[index];
        if (bulletIndex < 0 || bulletIndex >= item.bullets.length) return r;
        const bullets = [...item.bullets];
        bullets[bulletIndex] = value;
        const experience = [...r.experience];
        experience[index] = { ...item, bullets };
        applied = true;
        return { ...r, experience };
      });
      return applied;
    }
    default:
      return false;
  }
}

/**
 * AI tailoring: ask the server for suggestions, then accept or skip each one. Accepting can write
 * into the active resume or into a job-specific duplicate, depending on the toggle.
 */
export function AiTailorPanel({ resume, jobText, jobTitle, company, jobId }: AiTailorPanelProps) {
  const aiEnabled = useSettingsStore((s) => s.ai?.enabled === true);
  const updateResume = useResumeStore((s) => s.updateResume);
  const duplicateResume = useResumeStore((s) => s.duplicateResume);
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; description: string; retryable: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<AiTailorSuggestion[] | null>(null);
  const [note, setNote] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [copyFirst, setCopyFirst] = useState(false);
  const copyIdRef = useRef<string | null>(null);
  const [copyName, setCopyName] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.ai.tailor({
        resume,
        jobText,
        jobTitle: jobTitle || undefined,
        company: company || undefined,
      });
      setSuggestions(res.suggestions ?? []);
      setKeywords(res.keywordsToAdd ?? []);
      setNote(res.note ?? '');
      setDecisions({});
    } catch (e) {
      const copy = aiErrorCopy(e);
      setError(copy);
      toast.push({ title: copy.title, description: copy.description, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [resume, jobText, jobTitle, company, toast]);

  /** The resume suggestions are written into — duplicating on first accept when asked to. */
  const targetResumeId = useCallback((): string => {
    if (!copyFirst) return resume.id;
    if (copyIdRef.current) return copyIdRef.current;
    const newId = duplicateResume(resume.id);
    if (!newId) return resume.id;
    const label = company.trim() || jobTitle.trim() || 'tailored';
    const name = `${resume.name} — ${label}`;
    updateResume(newId, (r) => ({ ...r, name, tailoredForJobId: jobId ?? undefined }));
    copyIdRef.current = newId;
    setCopyName(name);
    toast.push({ title: `Created "${name}"`, description: 'Changes land on the copy; the original stays untouched.', tone: 'success' });
    return newId;
  }, [copyFirst, resume.id, resume.name, duplicateResume, updateResume, company, jobTitle, jobId, toast]);

  const accept = (suggestion: AiTailorSuggestion, index: number) => {
    const id = targetResumeId();
    const ok = applySuggestion(suggestion, updateResume, id);
    if (!ok) {
      toast.push({
        title: 'Could not apply that one',
        description: 'The bullet it points at no longer exists — regenerate the suggestions.',
        tone: 'error',
      });
      return;
    }
    setDecisions((d) => ({ ...d, [index]: 'accepted' }));
    toast.push({ title: `${TYPE_LABEL[suggestion.type]} updated`, tone: 'success', durationMs: 2500 });
  };

  const skip = (index: number) => setDecisions((d) => ({ ...d, [index]: 'skipped' }));

  if (!aiEnabled) return <AiUnavailable feature="Tailoring suggestions" />;

  const pending = suggestions?.filter((_, i) => !decisions[i]).length ?? 0;

  return (
    <div className="tl-ai stack-4">
      <Card padding="sm">
        <div className="tl-ai-bar">
          <div className="stack-1 grow">
            <Switch
              checked={copyFirst}
              onCheckedChange={(v) => setCopyFirst(v)}
              label="Create a tailored copy first"
              disabled={copyIdRef.current !== null}
            />
            <p className="small muted">
              {copyName
                ? `Writing into "${copyName}".`
                : copyFirst
                  ? `Accepting the first suggestion duplicates "${resume.name}" as "${resume.name} — ${company.trim() || jobTitle.trim() || 'tailored'}".`
                  : `Accepted suggestions edit "${resume.name}" directly.`}
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={suggestions ? <RefreshCw size={15} /> : <Sparkles size={15} />}
            loading={loading}
            disabled={loading || jobText.trim().length < 40}
            onClick={() => void generate()}
          >
            {suggestions ? 'Regenerate' : 'Generate suggestions'}
          </Button>
        </div>
        {jobText.trim().length < 40 && (
          <p className="small muted">Pick or paste a job description first — the model needs something to work from.</p>
        )}
      </Card>

      {loading && (
        <Card padding="sm">
          <p className="tl-ai-loading" role="status">
            <span className="tl-spinner" aria-hidden="true" />
            Reading the posting against your resume — usually 10–30 s.
          </p>
        </Card>
      )}

      {error && !loading && (
        <EmptyState
          icon={<Sparkles size={18} />}
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

      {suggestions && !loading && !error && (
        <>
          {note && <p className="tl-ai-note">{note}</p>}
          {keywords.length > 0 && (
            <p className="small muted">
              Keywords the model would weave in: <strong>{keywords.join(', ')}</strong>
            </p>
          )}

          {suggestions.length === 0 ? (
            <EmptyState
              size="sm"
              title="No changes suggested"
              description="The model thinks this resume already lines up with the posting."
            />
          ) : (
            <>
              <p className="small muted" aria-live="polite">
                {pending} of {suggestions.length} still to review.
              </p>
              <ul className="tl-suggestions">
                {suggestions.map((suggestion, index) => {
                  const decision = decisions[index];
                  return (
                    <li key={`${suggestion.type}-${index}`} className={decision ? `tl-sugg tl-sugg-${decision}` : 'tl-sugg'}>
                      <div className="tl-sugg-head">
                        <Badge tone="accent" variant="soft" size="sm">
                          {TYPE_LABEL[suggestion.type]}
                        </Badge>
                        {decision && (
                          <Badge tone={decision === 'accepted' ? 'success' : 'neutral'} variant="soft" size="sm">
                            {decision === 'accepted' ? 'Accepted' : 'Skipped'}
                          </Badge>
                        )}
                      </div>
                      {suggestion.original && <p className="tl-sugg-before">{suggestion.original}</p>}
                      <p className="tl-sugg-after">{suggestion.suggested}</p>
                      <p className="small muted">{suggestion.reason}</p>
                      {!decision && (
                        <div className="tl-sugg-actions">
                          <Button size="sm" variant="primary" leftIcon={<Check size={14} />} onClick={() => accept(suggestion, index)}>
                            Accept
                          </Button>
                          <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={() => skip(index)}>
                            Skip
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      {!suggestions && !loading && !error && (
        <EmptyState
          icon={<Sparkles size={18} />}
          title="No suggestions yet"
          description="Generate a set and accept the ones that are true. The model rephrases and reorders — it never invents experience."
        />
      )}
    </div>
  );
}
