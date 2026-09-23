/**
 * Polish — the smart prompt under a prose field.
 *
 * Decisions (docs/DESIGN-SMART-PROMPT.md):
 *   - appears when he LEAVES the box, never while he types (the field is never rebuilt);
 *   - rewords only, never adds a fact — the server throws away any rewrite with a new number;
 *   - asks a follow-up question every time a fact is missing, and his answer is the only new
 *     fact a re-polish may use;
 *   - spelling is fixed in the browser as he types (spellFix); Claude only handles sentences;
 *   - his original words are kept on this device so "Undo" can always put them back.
 *
 * The card is a sibling of the field. On a phone the field he just left may scroll away, so when
 * the card lands off-screen a toast says "Polish ready" with a Show button.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Mic, MicOff, Undo2, Wand2 } from 'lucide-react';
import type { AiPolishAnswer, AiPolishKind, AiPolishResponse } from '@shared/types';
import { Button, IconButton, Input, useToast } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { forgetOriginal, keepOriginal, originalFor } from '@/lib/text/originals';
import { appendDictation, createRecognizer, speechSupported, type SpeechRecognizer } from '@/lib/text/speech';
import { useSettingsStore } from '@/stores/settingsStore';

/** Shorter than this and there is nothing to polish. */
export const MIN_POLISH_CHARS = 8;

export interface UsePolishOptions {
  value: string;
  kind: AiPolishKind;
  onApply: (text: string) => void;
  /** Shown in the toast, e.g. "Summary" or "Bullet 2". */
  label: string;
  role?: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface PolishState {
  /** Attach to the field's onBlur. */
  onBlur: () => void;
  /** Render right after the field. */
  card: ReactNode;
}

export function usePolish({ value, kind, onApply, label, role }: UsePolishOptions): PolishState {
  const aiEnabled = useSettingsStore((s) => s.ai?.enabled ?? false);
  const toast = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<AiPolishResponse | null>(null);
  const [answers, setAnswers] = useState<AiPolishAnswer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const valueRef = useRef(value);
  valueRef.current = value;
  /** The text the last request was for — a blur on the same text does nothing. */
  const sentRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [announce, setAnnounce] = useState(false);

  const run = async (text: string, withAnswers: AiPolishAnswer[]) => {
    const seq = ++seqRef.current;
    sentRef.current = text;
    setStatus('loading');
    setError(null);
    try {
      const res = await api.ai.polish({ text, kind, role, answers: withAnswers.length ? withAnswers : undefined });
      if (seq !== seqRef.current) return;
      // He went back and typed more while we waited — this suggestion is for old words.
      if (valueRef.current.trim() !== text) {
        setStatus('idle');
        return;
      }
      if (!res.changed && res.questions.length === 0) {
        setStatus('idle');
        setResult(null);
        return;
      }
      setResult(res);
      setDrafts({});
      setStatus('ready');
      setAnnounce(true);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(e instanceof ApiClientError ? e.message : 'Could not reach the AI service.');
      setStatus('error');
    }
  };

  // Once the card is on screen, tell him if it landed somewhere he can't see.
  useEffect(() => {
    if (!announce) return;
    setAnnounce(false);
    const el = cardRef.current;
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const box = el.getBoundingClientRect();
    const visible = box.bottom > 0 && box.top < (window.innerHeight || 0);
    if (visible || box.height === 0) return;
    toast.push({
      title: 'Polish ready',
      description: label,
      action: { label: 'Show', onClick: () => el.scrollIntoView({ behavior: 'smooth', block: 'center' }) },
    });
  }, [announce, label, toast]);

  const onBlur = () => {
    if (!aiEnabled) return;
    const text = value.trim();
    if (text.length < MIN_POLISH_CHARS) return;
    if (text === sentRef.current) return;
    if (result && text === result.polished) return;
    setAnswers([]);
    void run(text, []);
  };

  const dismiss = () => {
    seqRef.current += 1;
    setStatus('idle');
    setResult(null);
    setAnswers([]);
  };

  const use = () => {
    if (!result) return;
    const original = value;
    keepOriginal(result.polished, original);
    sentRef.current = result.polished.trim();
    onApply(result.polished);
    dismiss();
    toast.push({
      title: 'Polished',
      tone: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          forgetOriginal(result.polished);
          sentRef.current = original.trim();
          onApply(original);
        },
      },
    });
  };

  const answer = (question: string) => {
    const reply = (drafts[question] ?? '').trim();
    if (reply === '') return;
    const next = [...answers.filter((a) => a.question !== question), { question, answer: reply }];
    setAnswers(next);
    // Polish his current words (or the pending rewrite's source) again, now with the new fact.
    void run(value.trim(), next);
  };

  const original = originalFor(value);
  let card: ReactNode = null;

  if (status === 'loading') {
    card = (
      <div className="re-polish re-polish--loading" role="status" ref={cardRef}>
        <Wand2 size={14} aria-hidden="true" /> <span className="small">Polishing…</span>
      </div>
    );
  } else if (status === 'error') {
    card = (
      <div className="re-polish" role="alert" ref={cardRef}>
        <p className="small">{error}</p>
        <div className="re-polish__actions">
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  } else if (status === 'ready' && result) {
    card = (
      <div className="re-polish" role="region" aria-label={`Polish for ${label}`} ref={cardRef}>
        <p className="re-polish__eyebrow">
          <Wand2 size={13} aria-hidden="true" /> Polish
        </p>
        {result.changed ? (
          <>
            <p className="re-polish__text">{result.polished}</p>
            {result.why ? <p className="re-polish__why small subtle">{result.why}</p> : null}
          </>
        ) : (
          <p className="re-polish__why small subtle">Your wording is clean. One thing would make it stronger:</p>
        )}
        {result.questions.length > 0 ? (
          <ul className="re-polish__questions">
            {result.questions.map((question) => (
              <li key={question}>
                <label className="small strong" htmlFor={`pq-${label}-${question}`}>
                  {question}
                </label>
                <div className="re-polish__answer">
                  <Input
                    id={`pq-${label}-${question}`}
                    uiSize="sm"
                    value={drafts[question] ?? ''}
                    enterKeyHint="send"
                    placeholder="Your answer"
                    onChange={(e) => setDrafts((d) => ({ ...d, [question]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        answer(question);
                      }
                    }}
                  />
                  <Button size="sm" variant="secondary" onClick={() => answer(question)}>
                    Add
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="re-polish__actions">
          {result.changed ? (
            <Button size="sm" leftIcon={<Check size={14} />} onClick={use}>
              Use
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Keep mine
          </Button>
        </div>
      </div>
    );
  } else if (original !== null && original.trim() !== value.trim()) {
    card = (
      <div className="re-polish re-polish--undo">
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Undo2 size={13} />}
          onClick={() => {
            forgetOriginal(value);
            sentRef.current = original.trim();
            onApply(original);
          }}
        >
          Undo polish
        </Button>
      </div>
    );
  }

  return { onBlur, card };
}

export interface DictateButtonProps {
  value: string;
  onChange: (next: string) => void;
  /** e.g. "Dictate the summary". */
  label: string;
}

/** Mic button: talk instead of type. Renders nothing where the browser can't listen. */
export function DictateButton({ value, onChange, label }: DictateButtonProps) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognizer | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const toast = useToast();

  useEffect(() => () => recRef.current?.stop(), []);

  if (!speechSupported()) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = createRecognizer();
    if (!rec) return;
    rec.onresult = (event) => {
      let heard = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.isFinal) heard += ` ${result[0].transcript}`;
      }
      if (heard.trim()) {
        const next = appendDictation(valueRef.current, heard);
        valueRef.current = next;
        onChange(next);
      }
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.push({ title: 'Microphone blocked', description: 'Allow the microphone for this site to talk instead of type.', tone: 'error' });
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
    }
  };

  return (
    <IconButton
      size="sm"
      variant={listening ? 'primary' : 'ghost'}
      label={listening ? 'Stop listening' : label}
      icon={listening ? <MicOff size={14} /> : <Mic size={14} />}
      aria-pressed={listening}
      onClick={toggle}
    />
  );
}
