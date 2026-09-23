import { forwardRef, useCallback, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { cx } from './utils';
import { useFieldControl } from './Field';
import type { ControlSize } from './Input';
import { applySpellFix } from './spellFix';
import './controls.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  uiSize?: ControlSize;
  invalid?: boolean;
  /** Grow with the content instead of scrolling (min height = `rows`). */
  autoResize?: boolean;
  /** Upper bound for auto-resize, in pixels. */
  maxHeight?: number;
  /** Fix common misspellings as each word is finished ("recieve " → "receive "). */
  spellFix?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { uiSize = 'md', invalid, autoResize = false, maxHeight = 420, className, onChange, spellFix = false, ...rest },
  ref,
) {
  const field = useFieldControl({ id: rest.id, invalid, 'aria-describedby': rest['aria-describedby'], required: rest.required });
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [ref],
  );

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, maxHeight)}px`;
  }, [autoResize, maxHeight]);

  useLayoutEffect(resize, [resize, rest.value]);

  return (
    <textarea
      {...(spellFix ? { spellCheck: true, autoCorrect: 'on', autoCapitalize: 'sentences' } : null)}
      {...rest}
      ref={setRefs}
      id={field.id}
      required={field.required}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid || undefined}
      onChange={(e) => {
        if (spellFix) applySpellFix(e);
        onChange?.(e);
        resize();
      }}
      className={cx('ui-textarea', uiSize !== 'md' && `ui-textarea--${uiSize}`, className)}
    />
  );
});
