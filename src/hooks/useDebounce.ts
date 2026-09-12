import { useCallback, useEffect, useRef, useState } from 'react';

/** Returns `value` after it has stopped changing for `delayMs`. */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Debounced callback with a stable identity. The latest `fn` is always the one invoked,
 * and any pending call is cancelled on unmount.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs = 300,
): ((...args: A) => void) & { cancel: () => void; flush: () => void } {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const argsRef = useRef<A | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    argsRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const flush = useCallback(() => {
    if (timerRef.current !== null && argsRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const args = argsRef.current;
      argsRef.current = null;
      fnRef.current(...args);
    }
  }, []);

  const debounced = useCallback(
    (...args: A) => {
      argsRef.current = args;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        argsRef.current = null;
        fnRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );

  return Object.assign(debounced, { cancel, flush });
}
