import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cx, useControllableState } from './utils';
import { useDismissable, type PopoverAlign } from './Popover';
import './overlays.css';

interface MenuContextValue {
  close: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

interface TriggerProps {
  onClick?: (e: ReactMouseEvent) => void;
  onKeyDown?: (e: ReactKeyboardEvent) => void;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'menu';
  'aria-controls'?: string;
}

export interface MenuProps {
  /** Any focusable element (usually a `Button` or `IconButton`). */
  trigger: ReactNode;
  /** Accessible name for the menu. */
  label: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: PopoverAlign;
  up?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Dropdown menu following the WAI-ARIA menu button pattern:
 * ArrowDown/ArrowUp move between items, Home/End jump, Escape closes and
 * returns focus to the trigger, and selecting an item closes the menu.
 */
export function Menu({ trigger, label, open, defaultOpen = false, onOpenChange, align = 'start', up = false, className, children }: MenuProps) {
  const id = useId();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const autoFocusRef = useRef<'first' | 'last' | null>(null);
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);

  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismissable(isOpen, close, anchorRef);

  const items = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []),
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const list = items();
    if (list.length === 0) {
      menuRef.current?.focus();
      return;
    }
    const target = autoFocusRef.current === 'last' ? list[list.length - 1] : list[0];
    autoFocusRef.current = null;
    target?.focus();
  }, [isOpen, items]);

  const openWith = (which: 'first' | 'last') => {
    autoFocusRef.current = which;
    setOpen(true);
  };

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<TriggerProps>, {
        'aria-expanded': isOpen,
        'aria-haspopup': 'menu',
        'aria-controls': isOpen ? id : undefined,
        onClick: (e: ReactMouseEvent) => {
          (trigger as ReactElement<TriggerProps>).props.onClick?.(e);
          if (e.defaultPrevented) return;
          if (isOpen) close();
          else openWith('first');
        },
        onKeyDown: (e: ReactKeyboardEvent) => {
          (trigger as ReactElement<TriggerProps>).props.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            openWith('first');
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            openWith('last');
          }
        },
      })
    : trigger;

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = items();
    if (list.length === 0) return;
    const index = list.findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <div className="ui-pop-anchor" ref={anchorRef}>
      {triggerNode}
      {isOpen ? (
        <MenuContext.Provider value={{ close }}>
          <div
            id={id}
            ref={menuRef}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            className={cx('ui-pop', 'ui-menu', `ui-pop--${align}`, up && 'ui-pop--up', className)}
          >
            {children}
          </div>
        </MenuContext.Provider>
      ) : null}
    </div>
  );
}

export interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  /** Called when the item is activated; the menu closes afterwards. */
  onSelect?: () => void;
  icon?: ReactNode;
  /** Right-aligned hint, e.g. a `Kbd`. */
  shortcut?: ReactNode;
  /** Renders as a checked option (role="menuitemradio" semantics via aria-checked). */
  checked?: boolean;
  danger?: boolean;
  children: ReactNode;
}

export function MenuItem({ onSelect, icon, shortcut, checked, danger, className, children, onClick, ...rest }: MenuItemProps) {
  const ctx = useContext(MenuContext);
  return (
    <button
      {...rest}
      type="button"
      role="menuitem"
      aria-checked={checked === undefined ? undefined : checked}
      tabIndex={-1}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        onSelect?.();
        ctx?.close();
      }}
      className={cx('ui-menu__item', danger && 'ui-menu__item--danger', className)}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="ui-menu__label">{children}</span>
      {shortcut ? <span className="ui-menu__shortcut">{shortcut}</span> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="ui-menu__sep" role="separator" />;
}

export function MenuGroupLabel({ children }: { children: ReactNode }) {
  return <div className="ui-menu__group">{children}</div>;
}
