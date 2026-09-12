import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cx } from './utils';
import './overlays.css';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Tooltip text. When empty, the trigger renders with no tooltip at all. */
  content: ReactNode;
  side?: TooltipSide;
  /** Hover delay in ms (focus shows immediately). */
  delayMs?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Hover/focus tooltip. Purely supplementary — never put essential information here,
 * and always give icon-only triggers their own `aria-label` (see `IconButton`).
 */
export function Tooltip({ content, side = 'top', delayMs = 250, className, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = (immediate = false) => {
    if (timer.current) clearTimeout(timer.current);
    if (immediate || delayMs <= 0) {
      setOpen(true);
      return;
    }
    timer.current = setTimeout(() => setOpen(true), delayMs);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!content) return <>{children}</>;

  const described =
    isValidElement(children) && open
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': id })
      : children;

  return (
    <span
      className={cx('ui-tooltip-anchor', className)}
      onMouseEnter={() => show()}
      onMouseLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {described}
      {open ? (
        <span role="tooltip" id={id} className={cx('ui-tooltip', `ui-tooltip--${side}`)}>
          {content}
        </span>
      ) : null}
    </span>
  );
}
