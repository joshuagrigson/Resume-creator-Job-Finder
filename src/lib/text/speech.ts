/**
 * Talk instead of type — the browser's built-in speech recognition (Chrome, Edge, Safari).
 * Firefox has none, so callers hide the mic when `speechSupported()` is false.
 */

export interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognizerCtor = new () => SpeechRecognizer;

function ctor(): RecognizerCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return ctor() !== null;
}

export function createRecognizer(): SpeechRecognizer | null {
  const Ctor = ctor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
  rec.continuous = true;
  rec.interimResults = false;
  return rec;
}

/** Adds dictated words to what's already in the field, with a space and a capital where needed. */
export function appendDictation(current: string, spoken: string): string {
  const words = spoken.trim();
  if (words === '') return current;
  const base = current.replace(/\s+$/, '');
  if (base === '') return words.charAt(0).toUpperCase() + words.slice(1);
  const endsSentence = /[.!?]$/.test(base);
  const next = endsSentence ? words.charAt(0).toUpperCase() + words.slice(1) : words;
  return `${base} ${next}`;
}
