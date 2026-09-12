/**
 * Local HTML hygiene for job descriptions.
 *
 * Deliberately dependency-free and self-contained: it runs on the server before anything
 * is cached or sent to the browser (the browser still runs DOMPurify before rendering).
 * Nothing here is a substitute for DOMPurify — it is a first pass that removes the
 * obviously dangerous constructs and keeps cached payloads small.
 */

/** Hard cap for stored description HTML. */
export const MAX_DESCRIPTION_HTML_BYTES = 60_000;
/** Hard cap for the plain-text projection used for matching/preview. */
export const MAX_DESCRIPTION_TEXT_CHARS = 20_000;

/** Elements removed together with their content. */
const DANGEROUS_ELEMENTS = ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'frame', 'frameset'];

const DANGEROUS_BLOCK_RE = new RegExp(`<(${DANGEROUS_ELEMENTS.join('|')})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
const DANGEROUS_TAG_RE = new RegExp(`<\\/?(?:${DANGEROUS_ELEMENTS.join('|')})\\b[^>]*>`, 'gi');
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const EVENT_ATTR_RE = /\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/gi;
const URL_ATTR_RE = /\s(href|src|xlink:href|action|formaction|background|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const DANGEROUS_URL_RE = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html|livescript|mocha)\b/i;
const SRCDOC_RE = /\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/gi;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  ndash: '-',
  mdash: '-',
  minus: '-',
  hellip: '...',
  lsquo: "'",
  rsquo: "'",
  sbquo: "'",
  ldquo: '"',
  rdquo: '"',
  bdquo: '"',
  bull: '*',
  middot: '*',
  sect: 'S',
  para: 'P',
  copy: '(c)',
  reg: '(r)',
  trade: '(tm)',
  deg: ' degrees',
  plusmn: '+/-',
  times: 'x',
  divide: '/',
  frac12: '1/2',
  frac14: '1/4',
  frac34: '3/4',
  euro: 'EUR',
  pound: 'GBP',
  yen: 'JPY',
  cent: 'c',
  eacute: 'e',
  egrave: 'e',
  agrave: 'a',
  ccedil: 'c',
  uuml: 'u',
  ouml: 'o',
  auml: 'a',
  szlig: 'ss',
  ntilde: 'n',
  laquo: '"',
  raquo: '"',
  dagger: '+',
  prime: "'",
  Prime: '"',
  rarr: '->',
  larr: '<-',
  harr: '<->',
  check: 'v',
  cross: 'x',
};

/** Tags after which a line break reads better in the plain-text projection. */
const BLOCK_BOUNDARY_RE =
  /<\/?(?:p|div|br|li|ul|ol|tr|td|th|table|thead|tbody|section|article|header|footer|aside|nav|h[1-6]|blockquote|pre|hr|dl|dt|dd|figure|figcaption|form|fieldset|address|main)\b[^>]*>/gi;

/** Decode the HTML entities that actually show up in job descriptions. */
export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      // Skip surrogate halves and C0 controls other than tab/newline.
      if (code >= 0xd800 && code <= 0xdfff) return '';
      if (code < 0x20 && code !== 0x09 && code !== 0x0a) return ' ';
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/**
 * HTML → readable plain text. Entities decoded, block tags become line breaks,
 * runs of whitespace collapsed. Never throws.
 *
 * This intentionally does not import `shared/text.ts`: the job pipeline must stay
 * usable on its own and the shared module has a different (browser-facing) contract.
 */
export function stripHtml(html: unknown): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  let out = html;
  out = out.replace(COMMENT_RE, ' ');
  out = out.replace(DANGEROUS_BLOCK_RE, ' ');
  out = out.replace(DANGEROUS_TAG_RE, ' ');
  out = out.replace(BLOCK_BOUNDARY_RE, '\n');
  out = out.replace(/<[^>]*>/g, ' ');
  out = decodeEntities(out);
  out = out.replace(/\r\n?/g, '\n');
  out = out.replace(/[^\S\n]+/g, ' ');
  out = out.replace(/ *\n */g, '\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

/** Plain text projection, capped so cached jobs stay small. */
export function toDescriptionText(html: unknown, maxChars = MAX_DESCRIPTION_TEXT_CHARS): string {
  const text = stripHtml(html);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).replace(/\s+\S*$/, '')}…`;
}

/**
 * First-pass sanitize of source HTML: removes script/style/iframe/object/embed blocks,
 * `on*=` handlers, `javascript:`/`vbscript:`/`data:text/html` URLs, and caps the size.
 * The client still runs DOMPurify before rendering.
 */
export function sanitizeHtml(html: unknown, maxBytes = MAX_DESCRIPTION_HTML_BYTES): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  let out = html;
  out = out.replace(COMMENT_RE, '');
  out = out.replace(DANGEROUS_BLOCK_RE, '');
  out = out.replace(DANGEROUS_TAG_RE, '');
  out = out.replace(EVENT_ATTR_RE, '');
  out = out.replace(SRCDOC_RE, '');
  out = out.replace(URL_ATTR_RE, (match, name: string, dq?: string, sq?: string, bare?: string) => {
    const raw = dq ?? sq ?? bare ?? '';
    // Strip control characters used to smuggle `java\u0000script:` past naive checks.
    const value = decodeEntities(raw).replace(/[\u0000-\u0020]/g, '');
    return DANGEROUS_URL_RE.test(value) ? ` ${name}="#"` : match;
  });
  out = out.trim();
  if (out.length > maxBytes) {
    // Truncate on a tag boundary so we never leave a half-written element behind.
    out = out.slice(0, maxBytes).replace(/<[^>]*$/, '');
  }
  return out;
}
