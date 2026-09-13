/** Chip-style multi-value input: Enter or comma commits, paste splits, Backspace deletes the last chip. */
import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Chip, Field } from '@/components/ui';

export interface TagInputProps {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  /** Accessible name when no visible label is rendered. */
  ariaLabel?: string;
  disabled?: boolean;
}

/** Split pasted or typed text on commas, semicolons, pipes, newlines and bullet glyphs. */
export function splitTags(raw: string): string[] {
  return raw
    .split(/[,;|\n\r\t•·]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function addTags(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((t) => t.toLowerCase()));
  const next = [...current];
  for (const tag of incoming) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(tag);
  }
  return next;
}

export function TagInput({ label, value, onChange, placeholder, hint, ariaLabel, disabled = false }: TagInputProps) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commit = (raw: string) => {
    const tags = splitTags(raw);
    if (tags.length) onChange(addTags(value, tags));
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text || !/[,;|\n]/.test(text)) return;
    e.preventDefault();
    commit(`${draft}${draft ? ',' : ''}${text}`);
  };

  const control = (
    <div
      className="re-taginput"
      onClick={() => inputRef.current?.focus()}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.focus();
      }}
      role="presentation"
    >
      <ul className="re-taginput__list">
        {value.map((tag, index) => (
          <li key={`${tag}-${index}`}>
            <Chip
              onRemove={disabled ? undefined : () => onChange(value.filter((_, i) => i !== index))}
              removeLabel={`Remove ${tag}`}
            >
              {tag}
            </Chip>
          </li>
        ))}
      </ul>
      <input
        ref={inputRef}
        id={id}
        className="re-taginput__input"
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel ?? (label ? undefined : 'Add a value')}
        placeholder={value.length === 0 ? (placeholder ?? 'Type and press Enter') : 'Add another…'}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => commit(draft)}
      />
    </div>
  );

  if (!label) return control;
  return (
    <Field label={label} htmlFor={id} hint={hint ?? 'Press Enter or comma to add'}>
      {control}
    </Field>
  );
}
