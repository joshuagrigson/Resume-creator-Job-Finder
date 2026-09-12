import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Portal } from './Portal';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { useDialogBehavior } from './useDialog';
import { cx } from './utils';
import './overlays.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Sub-line under the title; also used as the dialog description. */
  description?: ReactNode;
  /** Buttons at the bottom right. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Clicking the backdrop closes the dialog (default true). */
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
  /** Element focused when the dialog opens. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Accessible name when no visible `title` is rendered. */
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Centered dialog. Traps focus, closes on Escape and backdrop click, restores focus
 * to the trigger, and locks background scrolling while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  hideCloseButton = false,
  initialFocusRef,
  ariaLabel,
  className,
  children,
}: ModalProps) {
  const id = useId();
  const dialogRef = useDialogBehavior({ open, onClose, closeOnEscape, initialFocusRef });

  if (!open) return null;

  const titleId = title ? `${id}-title` : undefined;
  const descId = description ? `${id}-desc` : undefined;
  const hasHeader = Boolean(title || description || !hideCloseButton);

  return (
    <Portal>
      <div
        className="ui-overlay ui-modal-overlay"
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
          aria-describedby={descId}
          aria-label={titleId ? undefined : ariaLabel}
          tabIndex={-1}
          className={cx('ui-modal', size !== 'md' && `ui-modal--${size}`, className)}
        >
          {hasHeader ? (
            <div className="ui-modal__header">
              <div className="ui-modal__titles">
                {title ? (
                  <h2 className="ui-modal__title" id={titleId}>
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p className="ui-modal__desc" id={descId}>
                    {description}
                  </p>
                ) : null}
              </div>
              {hideCloseButton ? null : <IconButton label="Close dialog" icon={<X size={16} />} onClick={onClose} />}
            </div>
          ) : null}
          <div className={cx('ui-modal__body', !hasHeader && 'ui-modal__body--only')}>{children}</div>
          {footer ? <div className="ui-modal__footer">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use the danger styling for destructive confirmations. */
  destructive?: boolean;
  busy?: boolean;
}

/** Small yes/no dialog built on `Modal`. The confirm button receives initial focus. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
