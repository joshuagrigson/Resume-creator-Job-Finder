import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { IconButton } from './IconButton';
import { Portal } from './Portal';
import { cx } from './utils';
import './overlays.css';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay. 0 keeps the toast until dismissed. Defaults: 4.5s, 8s for errors. */
  durationMs?: number;
  /** Optional inline action, e.g. { label: 'Undo', onClick }. */
  action?: { label: string; onClick: () => void };
}

export interface ToastRecord extends ToastOptions {
  id: string;
}

export interface ToastApi {
  /** Show a toast; returns its id. */
  push: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={17} />,
  error: <AlertCircle size={17} />,
  info: <Info size={17} />,
};

let seq = 0;

/** Mount once near the root (the AppShell does it). Provides `useToast()`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (options: ToastOptions) => {
      seq += 1;
      const id = `toast-${seq}`;
      const tone = options.tone ?? 'info';
      const duration = options.durationMs ?? (tone === 'error' ? 8000 : 4500);
      setToasts((list) => [...list, { ...options, tone, id }].slice(-4));
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const clear = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ push, dismiss, clear }), [push, dismiss, clear]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <div className="toast-viewport no-print" role="region" aria-label="Notifications">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx('ui-toast', `ui-toast--${t.tone ?? 'info'}`)}
              role={t.tone === 'error' ? 'alert' : 'status'}
              aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
            >
              <span className="ui-toast__icon" aria-hidden="true">
                {ICONS[t.tone ?? 'info']}
              </span>
              <div className="ui-toast__content">
                <div className="ui-toast__title">{t.title}</div>
                {t.description ? <div className="ui-toast__desc">{t.description}</div> : null}
                {t.action ? (
                  <button
                    type="button"
                    className="ui-toast__action ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                  >
                    <span className="ui-btn__label">{t.action.label}</span>
                  </button>
                ) : null}
              </div>
              <IconButton label="Dismiss notification" size="sm" icon={<X size={14} />} onClick={() => dismiss(t.id)} />
            </div>
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

/** Access the toast queue. Must be called under a `ToastProvider` (AppShell mounts one). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider> (the AppShell mounts one).');
  return ctx;
}
