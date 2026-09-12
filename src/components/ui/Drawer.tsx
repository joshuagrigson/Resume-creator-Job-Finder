import { useId, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Portal } from './Portal';
import { IconButton } from './IconButton';
import { useDialogBehavior } from './useDialog';
import { cx } from './utils';
import './overlays.css';

export type DrawerSide = 'right' | 'left' | 'bottom';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Which edge the sheet slides in from. Use "bottom" for mobile sheets. */
  side?: DrawerSide;
  title?: ReactNode;
  footer?: ReactNode;
  /** Width for left/right, max height for bottom. Any CSS length. */
  size?: number | string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

/** Slide-in panel / mobile sheet. Same focus and Escape behaviour as `Modal`. */
export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  footer,
  size,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  hideCloseButton = false,
  initialFocusRef,
  ariaLabel,
  className,
  children,
}: DrawerProps) {
  const id = useId();
  const dialogRef = useDialogBehavior({ open, onClose, closeOnEscape, initialFocusRef });

  if (!open) return null;

  const titleId = title ? `${id}-title` : undefined;
  const sizeValue = typeof size === 'number' ? `${size}px` : size;

  return (
    <Portal>
      <div
        className={cx('ui-overlay', 'ui-drawer-overlay', `ui-drawer-overlay--${side}`)}
        onMouseDown={(e) => {
          if (!closeOnOverlayClick) return;
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-label={titleId ? undefined : ariaLabel}
          tabIndex={-1}
          style={sizeValue ? ({ ['--drawer-size']: sizeValue } as React.CSSProperties) : undefined}
          className={cx('ui-drawer', `ui-drawer--${side}`, className)}
        >
          {side === 'bottom' ? <div className="ui-drawer__grab" aria-hidden="true" /> : null}
          {title || !hideCloseButton ? (
            <div className="ui-drawer__header">
              <h2 className="ui-drawer__title truncate" id={titleId}>
                {title}
              </h2>
              {hideCloseButton ? null : <IconButton label="Close panel" icon={<X size={16} />} onClick={onClose} />}
            </div>
          ) : null}
          <div className="ui-drawer__body">{children}</div>
          {footer ? <div className="ui-drawer__footer">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  );
}
