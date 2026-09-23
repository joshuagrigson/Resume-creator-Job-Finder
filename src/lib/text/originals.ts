/**
 * His own words, kept on this device only.
 *
 * When he taps "Use" on a Polish suggestion, the text he typed is saved here, keyed by the
 * polished text that replaced it. As long as a field still holds that polished text, "Undo"
 * can put his words back — after a reload too. Nothing here is ever sent to the server.
 */
const KEY = 'launchpad.polish.originals.v1';
const MAX_ENTRIES = 200;

type Store = Record<string, { original: string; at: number }>;

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  cache = read();
  return cache;
}

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function save(store: Store): void {
  const entries = Object.entries(store).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
  cache = Object.fromEntries(entries);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode or a full disk: Undo still works for this session through the caller's state.
  }
}

function keyFor(polished: string): string {
  return polished.trim();
}

/** Remember that `polished` replaced `original`. */
export function keepOriginal(polished: string, original: string): void {
  if (keyFor(polished) === '' || polished.trim() === original.trim()) return;
  const store = load();
  // Polishing twice keeps the words he actually typed, not the first polish.
  const earlier = store[keyFor(original)]?.original;
  store[keyFor(polished)] = { original: earlier ?? original, at: Date.now() };
  save(store);
}

/** His words behind this polished text, if this device has them. */
export function originalFor(polished: string): string | null {
  return load()[keyFor(polished)]?.original ?? null;
}

/** Tests only: drop the in-memory copy so the next read comes from localStorage. */
export function resetOriginalsCache(): void {
  cache = null;
}

export function forgetOriginal(polished: string): void {
  const store = load();
  if (!(keyFor(polished) in store)) return;
  delete store[keyFor(polished)];
  save(store);
}
