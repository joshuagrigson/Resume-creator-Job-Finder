/**
 * Job descriptions arrive as untrusted HTML from third-party boards. Nothing reaches
 * `dangerouslySetInnerHTML` without going through here first.
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize board HTML and force every surviving link to open safely in a new tab.
 * Returns an empty string for empty input.
 */
export function sanitizeJobHtml(html: string | undefined): string {
  const raw = (html ?? '').trim();
  if (!raw) return '';

  // `style` is forbidden as an attribute as well as an element: a surviving inline
  // style can cover the viewport (clickjacking) or fetch a third-party background
  // image (a tracking beacon). A job description needs neither.
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'img', 'svg'],
    FORBID_ATTR: ['style'],
  });

  if (typeof window === 'undefined' || typeof window.DOMParser !== 'function') return clean;

  try {
    const doc = new window.DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
    doc.body.querySelectorAll('a').forEach((anchor) => {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    });
    return doc.body.innerHTML;
  } catch {
    return clean;
  }
}

/** Split plain-text descriptions into paragraphs for sources that send no HTML. */
export function textParagraphs(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
