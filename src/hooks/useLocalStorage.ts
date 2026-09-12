import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * `useState` backed by localStorage. Ephemeral UI preferences only — domain data belongs
 * in the zustand stores, which already persist.
 *
 * Safe when storage is unavailable (private mode, SSR, tests): falls back to memory.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const initialRef = useRef(initialValue);

  const [value, setValue] = useState<T>(() => read(key, initialRef.current));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  // Re-read when the key changes so the hook is reusable across dynamic keys.
  useEffect(() => {
    setValue(read(key, initialRef.current));
  }, [key]);

  // Keep tabs in sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setValue(read(key, initialRef.current));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, set];
}

function read<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the in-memory value still works */
  }
}
