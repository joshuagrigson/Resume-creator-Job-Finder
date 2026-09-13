/**
 * Persistence backend shared by every store.
 *
 * localStorage throws when the origin's quota is exhausted (and in private windows where
 * it is blocked outright). Zustand's `persist` calls `setItem` synchronously inside the
 * `set` that triggered it, so an unguarded throw escapes into whatever component dispatched
 * the update — a saved job or a typed character would take the whole page down, and the
 * Job Finder would sit on a spinner forever because `loading` never got cleared.
 *
 * Writes are therefore best-effort: the in-memory state stays correct and the app keeps
 * working, and `storageFailure()` reports what happened so Settings can say so plainly.
 */
import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

export type StorageFailure = 'quota' | 'unavailable';

let failure: StorageFailure | null = null;
const listeners = new Set<(value: StorageFailure | null) => void>();

/** The current persistence problem, or null while saving works. */
export function storageFailure(): StorageFailure | null {
  return failure;
}

/** Subscribe to persistence problems. Returns an unsubscribe function. */
export function onStorageFailure(listener: (value: StorageFailure | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setFailure(next: StorageFailure | null): void {
  if (failure === next) return;
  failure = next;
  for (const listener of listeners) listener(next);
}

/** Test seam: forget any recorded failure. */
export function resetStorageFailure(): void {
  setFailure(null);
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Chrome/Safari/Firefox all report quota differently; name is the reliable part.
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    (error as { code?: number }).code === 22
  );
}

/** localStorage that never throws on write. Reads fall back to null. */
const safeLocalStorage: Storage | undefined =
  typeof window === 'undefined'
    ? undefined
    : ({
        getItem(key: string) {
          try {
            return window.localStorage.getItem(key);
          } catch {
            setFailure('unavailable');
            return null;
          }
        },
        setItem(key: string, value: string) {
          try {
            window.localStorage.setItem(key, value);
            setFailure(null);
          } catch (error) {
            setFailure(isQuotaError(error) ? 'quota' : 'unavailable');
          }
        },
        removeItem(key: string) {
          try {
            window.localStorage.removeItem(key);
          } catch {
            setFailure('unavailable');
          }
        },
      } as Storage);

/** Pass as `storage` to zustand `persist`. */
export function createSafeStorage<T>(): PersistStorage<T> | undefined {
  return createJSONStorage<T>(() => safeLocalStorage ?? undefinedStorage);
}

/** A no-op Storage for server rendering and tests without a DOM. */
const undefinedStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
} as unknown as Storage;

/** Human-readable explanation for the Settings panel. */
export function storageFailureMessage(value: StorageFailure): string {
  return value === 'quota'
    ? 'This browser is out of local storage, so changes are no longer being saved. Export a backup, then clear old data to free space.'
    : 'This browser is blocking local storage, so changes will be lost when you close the tab. Private browsing usually causes this.';
}
