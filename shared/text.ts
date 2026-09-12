/**
 * Text normalization helpers shared by the browser app and the API server.
 *
 * Dependency-free on purpose: no DOM, no Node built-ins, no imports outside `shared/`.
 * Everything here must stay pure and fast — `scoreJobMatch` runs these over thousands of
 * job descriptions per search.
 */

// ---------------------------------------------------------------------------
// HTML → text
// ---------------------------------------------------------------------------

/** Elements whose *content* is not readable text at all. */
const DROP_CONTENT_RE = /<(script|style|noscript|template|svg|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/** Tags that imply a line break where they open or close. */
const BLOCK_TAG_RE =
  /<\/?(?:p|div|section|article|header|footer|main|aside|nav|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|h[1-6]|blockquote|pre|figure|figcaption|form|fieldset|hr|address)\b[^>]*>/gi;

const BR_TAG_RE = /<br\s*\/?>/gi;

const ANY_TAG_RE = /<[^>]*>/g;

const NAMED_ENTITIES: Record<string, string> = {
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
  zwj: '',
  zwnj: '',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  times: '×',
  divide: '÷',
  plusmn: '±',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  laquo: '«',
  raquo: '»',
  dagger: '†',
  sect: '§',
  para: '¶',
  larr: '←',
  rarr: '→',
  harr: '↔',
  ne: '≠',
  le: '≤',
  ge: '≥',
};

const ENTITY_RE = /&(#x?[0-9a-f]+|[a-z][a-z0-9]{1,31});/gi;

/** Decode the HTML entities that actually show up in job-board payloads. */
export function decodeEntities(input: string): string {
  if (!input || input.indexOf('&') === -1) return input;
  return input.replace(ENTITY_RE, (match, body: string) => {
    if (body.charCodeAt(0) === 35 /* # */) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      // Lone surrogates would corrupt the string.
      if (code >= 0xd800 && code <= 0xdfff) return '';
      if (code === 160) return ' ';
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/**
 * Convert (untrusted) HTML into readable plain text: tags removed, entities decoded,
 * block elements and `<br>` turned into line breaks, whitespace collapsed.
 *
 * This is *not* a sanitizer — never inject the result back into the DOM as HTML.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  let out = String(html);
  if (out.indexOf('<') !== -1) {
    out = out.replace(DROP_CONTENT_RE, '\n');
    out = out.replace(/<!--[\s\S]*?-->/g, ' ');
    out = out.replace(BR_TAG_RE, '\n');
    out = out.replace(BLOCK_TAG_RE, '\n');
    out = out.replace(ANY_TAG_RE, ' ');
  }
  out = decodeEntities(out);
  return collapseWhitespace(out);
}

/**
 * Collapse runs of spaces/tabs, trim every line, and cap blank runs at one empty line
 * so paragraph structure survives but the text stays compact.
 */
export function collapseWhitespace(input: string): string {
  if (!input) return '';
  const normalized = input
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    // Line/paragraph separators are real breaks; zero-width marks and the BOM are noise.
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/[^\S\n]+/g, ' ');
  const lines = normalized.split('\n');
  const kept: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      blankRun += 1;
      if (blankRun > 1 || kept.length === 0) continue;
      kept.push('');
      continue;
    }
    blankRun = 0;
    kept.push(trimmed);
  }
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  return kept.join('\n');
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Lowercase, unicode-normalize (NFKC), strip accents, collapse whitespace. */
export function normalizeText(s: string): string {
  if (!s) return '';
  let out = String(s);
  try {
    out = out.normalize('NFKC');
  } catch {
    /* Environments without full ICU still work with the raw string. */
  }
  out = out.toLowerCase();
  // Fold accents so "résumé" and "resume" tokenize the same.
  try {
    out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    /* ignore */
  }
  // Curly quotes / dashes → ASCII so "you'll" and "you’ll" behave alike.
  out = out.replace(/[\u2018\u2019\u201b\u2032]/g, "'").replace(/[\u201c\u201d\u2033]/g, '"').replace(/[\u2010-\u2015]/g, '-');
  return collapseWhitespace(out);
}

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

/**
 * Matches, in priority order:
 *  - `c++` / `g++` style tokens
 *  - `c#` / `f#` style tokens
 *  - a leading-dot token (`.net`)
 *  - a general word that may contain interior dots (`node.js`, `asp.net`) and interior
 *    slashes (`ci/cd`, `a/b`), optionally ending in `++` or `#`
 *
 * Trailing punctuation is never captured, so "management." yields "management".
 */
const TOKEN_RE = /[a-z]\+\+|[a-z]#|\.net|[a-z0-9]+(?:\.[a-z0-9]+)*(?:\/[a-z0-9]+)+|[a-z0-9]+(?:\.[a-z0-9]+)*/g;

/**
 * Tokenize a string that has already been through {@link normalizeText}. Skips the
 * (comparatively expensive) unicode normalization, which matters when a caller tokenizes
 * many small segments of one already-normalized document.
 */
export function tokenizeNormalized(normalized: string, keepSingleChars = false): string[] {
  if (!normalized) return [];
  const all = normalized.match(TOKEN_RE);
  if (!all) return [];
  if (keepSingleChars) return all;
  const out: string[] = [];
  for (const t of all) if (t.length > 1) out.push(t);
  return out;
}

/**
 * Split normalized text into tokens, keeping every token including single characters.
 * Used internally by dictionary matching, where "c", "r" and "go" are meaningful.
 */
export function tokenizeAll(s: string): string[] {
  return tokenizeNormalized(normalizeText(s), true);
}

/**
 * Public tokenizer: like {@link tokenizeAll} but drops single-character tokens, which are
 * noise for keyword statistics. Technology tokens survive intact:
 * `c++`, `c#`, `.net`, `node.js`, `react.js`, `ci/cd`, `a/b`, `3d`, `k8s`.
 */
export function tokenize(s: string): string[] {
  return tokenizeNormalized(normalizeText(s), false);
}

/** True when the token is only digits (and optional decimal point) — never a keyword. */
export function isNumericToken(token: string): boolean {
  return /^[0-9]+(?:\.[0-9]+)*$/.test(token);
}

// ---------------------------------------------------------------------------
// Stopwords
// ---------------------------------------------------------------------------

const STOPWORD_LIST = [
  'a','about','above','across','after','again','against','all','almost','along','already','also','although','always',
  'am','among','an','and','another','any','anyone','anything','are','around','as','at','available','away',
  'back','be','became','because','become','becomes','been','before','being','below','best','better','between','beyond',
  'both','but','by',
  'can','cannot','could','couldn','current','currently',
  'did','do','does','doing','done','down','due','during',
  'each','either','else','enough','etc','even','ever','every','everyone','everything','except',
  'far','few','for','from','further',
  'get','gets','getting','give','given','gives','going','got',
  'had','has','have','having','he','hence','her','here','hers','herself','him','himself','his','how','however',
  'i','if','in','include','includes','including','inside','instead','into','is','isn','it','its','itself',
  'just',
  'keep','kept',
  'largely','last','later','least','less','let','like','likely','ll','long','looking','lot',
  'made','mainly','make','makes','making','many','may','maybe','me','might','mine','more','most','much','must','my','myself',
  'near','need','needs','neither','never','new','next','no','none','nor','not','nothing','now',
  'of','off','often','on','once','one','only','onto','or','other','others','otherwise','our','ours','ourselves','out',
  'over','own',
  'per','perhaps','please','plus','put',
  'quite',
  'rather','re','really',
  'said','same','say','see','seen','set','shall','she','should','since','so','some','someone','something','sometimes',
  'soon','still','such','sure',
  'take','taken','takes','than','that','the','their','theirs','them','themselves','then','there','therefore','these',
  'they','thing','things','this','those','though','through','throughout','thus','to','together','too','toward','towards',
  'two','under','until','up','upon','us','use','used','uses','using','usually',
  've','very','via',
  'want','wants','was','way','we','well','were','what','when','where','whether','which','while','who','whom','whose',
  'why','will','with','within','without','won','would',
  'yes','yet','you','your','yours','yourself',
] as const;

/** Common English function words. Filtered out of keyword statistics. */
export const STOPWORDS: ReadonlySet<string> = new Set<string>(STOPWORD_LIST);

/**
 * Boilerplate that appears in nearly every job ad and therefore carries no signal.
 * Kept separate from {@link STOPWORDS} so callers can choose how aggressive to be.
 */
export const JOB_AD_STOPWORDS: ReadonlySet<string> = new Set<string>([
  'ability','able','accommodation','accommodations','act','action','activities','addition','additional','applicant',
  'applicants','application','applications','apply','applying','approach','appropriate','area','areas','assist',
  'background','base','based','basis','benefit','benefits','bonus','business','candidate','candidates','career',
  'careers','challenge','challenges','chance','check','client','clients','closely','colleagues','committed',
  'commitment','company','compensation','competitive','complex','contribute','create','creating','criminal','culture',
  'customer','day','days','deliver','delivering','department','description','detail','details','different','disability',
  'diverse','diversity','drive','driven','duties','duty','effectively','efficient','eligible','email','employee',
  'employees','employer','employment','environment','equal','essential','excellent','exciting','experience',
  'experienced','expertise','fast','field','focus','following','full','function','functions','future','gender','global',
  'goal','goals','great','group','grow','growing','growth','hard','health','help','high','highly','hire','hiring',
  'hour','hours','identity','impact','important','inclusion','inclusive','individual','individuals','industry',
  'information','initiative','innovative','insurance','interest','interested','job','join','knowledge','laws','leading',
  'level','life','location','looking','manner','meet','member','members','mission','months','multiple','national',
  'nature','office','offer','offers','opportunities','opportunity','order','organization','orientation','paced',
  'package','paid','part','partner','partners','passion','passionate','pay','people','performance','person','personal',
  'physical','position','positions','possible','potential','practice','practices','preferred','proven','provide',
  'provides','providing','qualification','qualifications','qualified','quality','race','range','rate','ready',
  'reasonable','receive','regard','regarding','regardless','related','religion','remote','report','reporting',
  'requirement','requirements','required','requires','resource','resources','responsibilities','responsibility',
  'responsible','result','results','resume','role','roles','salary','schedule','scope','seeking','self','senior',
  'service','services','sexual','skill','skills','solution','solutions','someone','staff','standard','standards',
  'start','status','strong','success','successful','support','task','tasks','team','teams','thrive','time','today',
  'tools','top','track','training','type','understanding','unique','value','values','variety','various','veteran',
  'vision','week','weeks','welcome','work','working','workplace','world','year','years',
]);

/** Words that are neither useful alone nor useful inside a bigram. */
export function isNoiseToken(token: string): boolean {
  return token.length < 3 || STOPWORDS.has(token) || JOB_AD_STOPWORDS.has(token) || isNumericToken(token);
}
