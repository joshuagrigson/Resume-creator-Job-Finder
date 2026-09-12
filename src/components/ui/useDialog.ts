import { useEffect, useRef } from 'react';
import { focusableWithin } from './utils';

let lockCount = 0;
let previousOverflow = '';

function lockScroll() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlockScroll() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = previousOverflow;
}

export interface DialogBehaviorOptions {
  open: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  /** Focused when the dialog opens; defaults to the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Shared modal behaviour: focus trap, Escape to close, focus restoration and
 * body scroll lock. Attach the returned ref to the dialog element.
 */
export function useDialogBehavior({ open, onClose, closeOnEscape = true, initialFocusRef }: DialogBehaviorOptions) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();

    // Move focus inside on open.
    const focusTimer = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? focusableWithin(dialogRef.current)[0] ?? dialogRef.current;
      target?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const nodes = focusableWithin(dialogRef.current);
      if (nodes.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;
      const inside = dialogRef.current?.contains(active as Node);

      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      unlockScroll();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open, closeOnEscape, initialFocusRef]);

  return dialogRef;
}
