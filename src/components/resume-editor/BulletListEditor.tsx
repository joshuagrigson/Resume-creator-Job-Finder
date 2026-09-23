/**
 * Bullet list editor.
 *
 * Keyboard: Enter adds a bullet below the caret, Backspace in an empty bullet removes it,
 * Alt+ArrowUp / Alt+ArrowDown reorder. Buttons mirror every shortcut for pointer users.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button, IconButton, Popover, SkeletonText, Textarea, useToast } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { useSettingsStore } from '@/stores/settingsStore';
import { createQuestionGate, DictateButton, usePolish, type QuestionGate } from './Polish';
import { moveItem } from './sections';

export interface BulletListEditorProps {
  /** Accessible name for the whole group, e.g. "Bullets for Marketing Manager at Acme". */
  legend: string;
  bullets: string[];
  onChange: (next: string[]) => void;
  /** Passed to the AI as context, e.g. "Marketing Manager at Acme". */
  aiRole?: string;
  addLabel?: string;
  placeholder?: string;
}

export function BulletListEditor({
  legend,
  bullets,
  onChange,
  aiRole,
  addLabel = 'Add bullet',
  placeholder = 'Describe an achievement — start with a verb and include a number.',
}: BulletListEditorProps) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  // One follow-up question per job, shared by all of this job's bullets.
  const [questionGate] = useState(createQuestionGate);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return;
    const el = refs.current[focusIndex];
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
    setFocusIndex(null);
  }, [focusIndex, bullets.length]);

  const setBullet = (index: number, text: string) => {
    onChange(bullets.map((b, i) => (i === index ? text : b)));
  };

  const insertAfter = (index: number) => {
    const next = [...bullets];
    next.splice(index + 1, 0, '');
    onChange(next);
    setFocusIndex(index + 1);
  };

  const removeAt = (index: number) => {
    const next = bullets.filter((_, i) => i !== index);
    onChange(next);
    setFocusIndex(next.length === 0 ? null : Math.max(0, index - 1));
  };

  const move = (index: number, direction: 'up' | 'down') => {
    const to = direction === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= bullets.length) return;
    onChange(moveItem(bullets, index, to));
    setFocusIndex(to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertAfter(index);
      return;
    }
    if (e.key === 'Backspace' && bullets[index] === '' && bullets.length > 0) {
      e.preventDefault();
      removeAt(index);
      return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(index, e.key === 'ArrowUp' ? 'up' : 'down');
    }
  };

  return (
    <div className="re-bullets" role="group" aria-label={legend}>
      {bullets.length === 0 ? (
        <p className="re-bullets__empty subtle small">No bullets yet. Add one to describe what you achieved.</p>
      ) : null}

      <ul className="re-bullets__list">
        {bullets.map((bullet, index) => (
          <BulletRow
            key={index}
            index={index}
            count={bullets.length}
            bullet={bullet}
            legend={legend}
            placeholder={placeholder}
            aiRole={aiRole}
            questionGate={questionGate}
            fieldRef={(el) => {
              refs.current[index] = el;
            }}
            onText={(text) => setBullet(index, text)}
            onKeyDown={(e) => onKeyDown(e, index)}
            onMove={(direction) => move(index, direction)}
            onRemove={() => removeAt(index)}
          />
        ))}
      </ul>

      <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={() => insertAfter(bullets.length - 1)}>
        {addLabel}
      </Button>
    </div>
  );
}

interface BulletRowProps {
  index: number;
  count: number;
  bullet: string;
  legend: string;
  placeholder: string;
  aiRole?: string;
  questionGate: QuestionGate;
  fieldRef: (el: HTMLTextAreaElement | null) => void;
  onText: (text: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
}

/** One bullet: the field, its tools, and the Polish card that appears when he leaves it. */
function BulletRow({
  index,
  count,
  bullet,
  legend,
  placeholder,
  aiRole,
  questionGate,
  fieldRef,
  onText,
  onKeyDown,
  onMove,
  onRemove,
}: BulletRowProps) {
  const polish = usePolish({
    value: bullet,
    kind: 'bullet',
    role: aiRole,
    label: `Bullet ${index + 1}`,
    onApply: onText,
    questionGate,
    gateId: String(index),
  });

  return (
    <li className="re-bullets__row">
      <span className="re-bullets__dot" aria-hidden="true" />
      <Textarea
        spellFix
        ref={fieldRef}
        className="re-bullets__field"
        rows={2}
        autoResize
        value={bullet}
        aria-label={`${legend} — bullet ${index + 1}`}
        placeholder={placeholder}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={polish.onFocus}
        onBlur={polish.onBlur}
      />
      <div className="re-bullets__tools">
        <DictateButton value={bullet} onChange={onText} label={`Talk instead of type — bullet ${index + 1}`} />
        <BulletAiButton bullet={bullet} role={aiRole} onApply={onText} />
        <IconButton
          size="sm"
          label={`Move bullet ${index + 1} up`}
          icon={<ArrowUp size={14} />}
          disabled={index === 0}
          onClick={() => onMove('up')}
        />
        <IconButton
          size="sm"
          label={`Move bullet ${index + 1} down`}
          icon={<ArrowDown size={14} />}
          disabled={index === count - 1}
          onClick={() => onMove('down')}
        />
        <IconButton
          size="sm"
          variant="danger"
          label={`Delete bullet ${index + 1}`}
          icon={<Trash2 size={14} />}
          onClick={onRemove}
        />
      </div>
      {polish.card ? <div className="re-bullets__polish">{polish.card}</div> : null}
    </li>
  );
}

interface BulletAiButtonProps {
  bullet: string;
  role?: string;
  onApply: (text: string) => void;
}

/** Sparkle button → popover with 2–4 AI rewrites. Only rendered when the server has AI enabled. */
function BulletAiButton({ bullet, role, onApply }: BulletAiButtonProps) {
  const aiEnabled = useSettingsStore((s) => s.ai?.enabled ?? false);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  if (!aiEnabled) return null;

  const canRun = bullet.trim().length >= 8;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.ai.improveBullet({ bullet: bullet.trim(), role });
      setSuggestions(res.suggestions ?? []);
      if (!res.suggestions?.length) setError('The assistant did not return any rewrites. Try again.');
    } catch (e) {
      const message = e instanceof ApiClientError ? e.message : 'Could not reach the AI service.';
      setError(message);
      toast.push({ title: 'Could not improve that bullet', description: message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && canRun && !loading && suggestions.length === 0) void run();
      }}
      align="end"
      label="AI rewrites for this bullet"
      className="re-aipop"
      trigger={
        <IconButton
          size="sm"
          label="Improve this bullet with AI"
          icon={<Sparkles size={14} />}
          disabled={!canRun}
          title={canRun ? 'Improve with AI' : 'Write a few words first'}
        />
      }
    >
      {(close) => (
        <div className="re-aipop__body stack-2">
          <p className="small strong">Suggested rewrites</p>
          {loading ? <SkeletonText lines={3} label="Generating rewrites" /> : null}
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
          {!loading && !error && suggestions.length > 0 ? (
            <ul className="re-aipop__list">
              {suggestions.map((s, i) => (
                <li key={i} className="re-aipop__item">
                  <p className="small">{s}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onApply(s);
                      toast.push({ title: 'Bullet updated', tone: 'success' });
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
