/**
 * Tiny colour helpers for the resume accent. Used by the preview (tints, rules) and by the
 * DOCX export (which wants bare 6-digit hex).
 */

export const DEFAULT_ACCENT = '#1f5eff';

/** Accepts `#abc`, `abc`, `#aabbcc`, `AABBCC`; returns `#rrggbb` or the fallback. */
export function normalizeHex(value: string | undefined | null, fallback = DEFAULT_ACCENT): string {
  const raw = (value ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    const [r, g, b] = raw.toLowerCase().split('') as [string, string, string];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback;
}

/** `"#1f5eff"` → `"1F5EFF"` (what the `docx` package expects). */
export function hexForDocx(value: string | undefined | null, fallback = DEFAULT_ACCENT): string {
  return normalizeHex(value, fallback).slice(1).toUpperCase();
}

function channels(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Mix `amount` (0–1) of the colour into white — the sidebar's background tint. */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = channels(hex);
  const t = Math.max(0, Math.min(1, amount));
  return toHex(255 + (r - 255) * t, 255 + (g - 255) * t, 255 + (b - 255) * t);
}

/** Mix `amount` (0–1) of black into the colour. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = channels(hex);
  const t = Math.max(0, Math.min(1, amount));
  return toHex(r * (1 - t), g * (1 - t), b * (1 - t));
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A version of the accent that is always readable as text on white paper. Very light accents
 * (yellow, pale mint) get darkened until they clear roughly 4.5:1 against white.
 */
export function readableOnPaper(hex: string): string {
  let color = normalizeHex(hex);
  let guard = 0;
  while (luminance(color) > 0.35 && guard < 12) {
    color = shade(color, 0.18);
    guard += 1;
  }
  return color;
}
