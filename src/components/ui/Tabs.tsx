import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx, useControllableState } from './utils';
import './surfaces.css';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>`);
  return ctx;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled selected tab value. */
  value?: string;
  /** Initially selected value when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

/** Accessible tabs (WAI-ARIA pattern, automatic activation with arrow keys). */
export function Tabs({ value, defaultValue = '', onValueChange, className, children, ...rest }: TabsProps) {
  const baseId = useId();
  const [current, setCurrent] = useControllableState(value, defaultValue, onValueChange);

  return (
    <TabsContext.Provider value={{ value: current, setValue: setCurrent, baseId }}>
      <div {...rest} className={cx('ui-tabs', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the tab set — required for screen readers. */
  'aria-label': string;
  variant?: 'underline' | 'pills';
  children: ReactNode;
}

export function TabList({ variant = 'underline', className, children, onKeyDown, ...rest }: TabListProps) {
  const { setValue } = useTabs('TabList');
  const ref = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(e.key)) return;

      const tabs = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? []);
      if (tabs.length === 0) return;
      const activeIndex = tabs.findIndex((t) => t === document.activeElement);
      const from = activeIndex >= 0 ? activeIndex : tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const base = from >= 0 ? from : 0;

      let next = base;
      if (e.key === 'ArrowRight') next = (base + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (base - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else next = tabs.length - 1;

      const target = tabs[next];
      if (!target) return;
      e.preventDefault();
      const v = target.dataset.value;
      if (v !== undefined) setValue(v);
      target.focus();
    },
    [onKeyDown, setValue],
  );

  return (
    <div
      {...rest}
      ref={ref}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cx('ui-tablist', variant === 'pills' && 'ui-tablist--pills', className)}
    >
      {children}
    </div>
  );
}

export interface TabProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  value: string;
  icon?: ReactNode;
  /** Small pill with a number (result counts, issue counts). */
  count?: number;
  disabled?: boolean;
  children: ReactNode;
}

export function Tab({ value, icon, count, disabled, className, children, onClick, ...rest }: TabProps) {
  const { value: selected, setValue, baseId } = useTabs('Tab');
  const isSelected = selected === value;

  return (
    <button
      {...rest}
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      data-value={value}
      aria-selected={isSelected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        setValue(value);
      }}
      className={cx('ui-tab', className)}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
      {count !== undefined ? <span className="ui-tab__count">{count}</span> : null}
    </button>
  );
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Render the panel even while hidden (keeps expensive children mounted). */
  keepMounted?: boolean;
  children: ReactNode;
}

export function TabPanel({ value, keepMounted = false, className, children, ...rest }: TabPanelProps) {
  const { value: selected, baseId } = useTabs('TabPanel');
  const isSelected = selected === value;
  if (!isSelected && !keepMounted) return null;

  return (
    <div
      {...rest}
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      hidden={!isSelected}
      tabIndex={0}
      className={cx('ui-tabpanel', className)}
    >
      {children}
    </div>
  );
}
