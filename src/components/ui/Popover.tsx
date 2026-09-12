import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cx, useControllableState } from './utils';
import './overlays.css';

export type PopoverAlign = 'start' | 'end';

interface TriggerProps {
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'dialog' | 'menu' | 'true';
  'aria-controls'?: string;
}

/** Closes the overlay on outside pointer-down and on Escape (restoring trigger focus). */
export function useDismissable(
  open: boolean,
  close: () => void,
  anchorRef: React.RefObject<HTMLElement | null>,
  restoreFocus = true,
): void {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const node = anchorRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) closeRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
      if (restoreFocus) {
        const trigger = anchorRef.current?.querySelector<HTMLElement>('[aria-expanded]');
        trigger?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, anchorRef, restoreFocus]);
}

export interface PopoverProps {
  /** Any focusable element (usually a `Button`); it is cloned with the ARIA wiring. */
  trigger: ReactNode;
  /** Controlled open state. Omit for uncontrolled. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: PopoverAlign;
  /** Open upwards (e.g. for triggers near the bottom of the viewport). */
  up?: boolean;
  /** Accessible name for the popover surface. */
  label?: string;
  /** Adds default padding to the surface. */
  padded?: boolean;
  className?: string;
  /** Content, or a render function receiving `close`. */
  children: ReactNode | ((close: () => void) => ReactNode);
}

/** Anchored floating surface for filters, style panels and pickers. */
export function Popover({
  trigger,
  open,
  defaultOpen = false,
  onOpenChange,
  align = 'start',
  up = false,
  label,
  padded = true,
  className,
  children,
}: PopoverProps) {
  const id = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useDismissable(isOpen, close, anchorRef);

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<TriggerProps>, {
        'aria-expanded': isOpen,
        'aria-haspopup': 'dialog',
        'aria-controls': isOpen ? id : undefined,
        onClick: (e: React.MouseEvent) => {
          (trigger as ReactElement<TriggerProps>).props.onClick?.(e);
          if (e.defaultPrevented) return;
          setOpen(!isOpen);
        },
      })
    : trigger;

  return (
    <div className="ui-pop-anchor" ref={anchorRef}>
      {triggerNode}
      {isOpen ? (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cx('ui-pop', `ui-pop--${align}`, up && 'ui-pop--up', padded && 'ui-pop--padded', className)}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

/** Uncontrolled open state helper for callers that need to close a popover imperatively. */
export function usePopoverState(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  return {
    open,
    setOpen,
    close: useCallback(() => setOpen(false), []),
    toggle: useCallback(() => setOpen((v) => !v), []),
  };
}
