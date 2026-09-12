/**
 * Vocabulary used by the ATS analyzer: strong action verbs, weak bullet openers,
 * resume buzzwords and first-person detection.
 *
 * Pure data plus a few tiny lookups — no imports, no side effects, safe on the server.
 */

/**
 * ~300 strong resume verbs in base form. Irregular past tenses live in
 * {@link IRREGULAR_PAST_VERBS} because they cannot be derived by suffix stripping.
 */
export const ACTION_VERBS: readonly string[] = [
  'accelerate', 'accomplish', 'achieve', 'acquire', 'adapt', 'address', 'administer', 'adopt', 'advance', 'advise',
  'advocate', 'align', 'allocate', 'amplify', 'analyze', 'anticipate', 'appoint', 'appraise', 'approve', 'arbitrate',
  'architect', 'arrange', 'articulate', 'assemble', 'assess', 'assign', 'audit', 'author', 'authorize', 'automate',
  'balance', 'begin', 'benchmark', 'bolster', 'boost', 'bring', 'broker', 'budget', 'build', 'calculate',
  'campaign', 'capture', 'catalog', 'centralize', 'chair', 'champion', 'channel', 'chart', 'choose', 'clarify',
  'classify', 'coach', 'collaborate', 'collect', 'commission', 'communicate', 'compile', 'complete', 'compose', 'compute',
  'conceptualize', 'conduct', 'configure', 'consolidate', 'construct', 'consult', 'contract', 'control', 'convert', 'convey',
  'coordinate', 'correct', 'counsel', 'craft', 'create', 'cultivate', 'curate', 'customize', 'cut', 'deal',
  'debug', 'decentralize', 'decrease', 'define', 'delegate', 'deliver', 'demonstrate', 'deploy', 'design', 'detect',
  'determine', 'develop', 'devise', 'diagnose', 'direct', 'discover', 'dispatch', 'distribute', 'diversify', 'document',
  'double', 'draft', 'draw', 'drive', 'earn', 'edit', 'educate', 'elevate', 'eliminate', 'embed',
  'enable', 'encourage', 'energize', 'enforce', 'engineer', 'enhance', 'enlist', 'ensure', 'establish', 'estimate',
  'evaluate', 'examine', 'execute', 'expand', 'expedite', 'experiment', 'explain', 'explore', 'extend', 'extract',
  'facilitate', 'finalize', 'finance', 'find', 'forecast', 'formulate', 'foster', 'found', 'fulfill', 'fund',
  'gather', 'generate', 'govern', 'grow', 'guide', 'halve', 'handle', 'head', 'hire', 'hold',
  'host', 'identify', 'illustrate', 'implement', 'improve', 'increase', 'index', 'influence', 'inform', 'initiate',
  'innovate', 'inspect', 'inspire', 'install', 'institute', 'instruct', 'integrate', 'interpret', 'interview', 'introduce',
  'invent', 'inventory', 'invest', 'investigate', 'issue', 'judge', 'justify', 'keep', 'launch', 'lead',
  'lecture', 'leverage', 'license', 'lift', 'lobby', 'localize', 'maintain', 'make', 'manage', 'manufacture',
  'map', 'market', 'maximize', 'measure', 'mediate', 'meet', 'mentor', 'merge', 'migrate', 'minimize',
  'mobilize', 'model', 'moderate', 'modernize', 'modify', 'monitor', 'motivate', 'navigate', 'negotiate', 'nominate',
  'normalize', 'observe', 'obtain', 'onboard', 'operate', 'optimize', 'orchestrate', 'organize', 'originate', 'outline',
  'outperform', 'overhaul', 'oversee', 'own', 'partner', 'perfect', 'perform', 'persuade', 'pilot', 'pinpoint',
  'pioneer', 'plan', 'position', 'predict', 'prepare', 'present', 'preserve', 'preside', 'prevent', 'prioritize',
  'process', 'procure', 'produce', 'program', 'project', 'promote', 'proofread', 'propose', 'prototype', 'prove',
  'provide', 'publicize', 'publish', 'purchase', 'pursue', 'qualify', 'quantify', 'query', 'raise', 'rank',
  'rate', 'realign', 'rebuild', 'recommend', 'reconcile', 'record', 'recruit', 'redesign', 'reduce', 'refactor',
  'refine', 'reform', 'regulate', 'rehabilitate', 'reinforce', 'remodel', 'render', 'reorganize', 'repair', 'replace',
  'report', 'represent', 'research', 'reshape', 'resolve', 'restore', 'restructure', 'retain', 'retool', 'reveal',
  'review', 'revise', 'revitalize', 'revamp', 'rewrite', 'route', 'run', 'safeguard', 'salvage', 'save',
  'scale', 'schedule', 'screen', 'script', 'secure', 'segment', 'select', 'sell', 'send', 'serve',
  'service', 'set', 'shape', 'ship', 'simplify', 'simulate', 'slash', 'solve', 'source', 'speak',
  'spearhead', 'specify', 'speed', 'spend', 'sponsor', 'staff', 'standardize', 'steer', 'stimulate', 'streamline',
  'strengthen', 'structure', 'submit', 'succeed', 'summarize', 'supervise', 'supply', 'surpass', 'survey', 'sustain',
  'synthesize', 'systematize', 'tabulate', 'tailor', 'take', 'target', 'teach', 'test', 'tighten', 'track',
  'train', 'transform', 'transition', 'translate', 'transmit', 'trim', 'triple', 'troubleshoot', 'tutor', 'undertake',
  'unify', 'update', 'upgrade', 'validate', 'verify', 'visualize', 'win', 'write', 'yield',
];

/** Past tenses that suffix stripping cannot reach ("led" → "lead", "built" → "build"). */
export const IRREGULAR_PAST_VERBS: Readonly<Record<string, string>> = {
  began: 'begin',
  begun: 'begin',
  brought: 'bring',
  built: 'build',
  chose: 'choose',
  chosen: 'choose',
  cut: 'cut',
  dealt: 'deal',
  drew: 'draw',
  drove: 'drive',
  driven: 'drive',
  found: 'find',
  grew: 'grow',
  grown: 'grow',
  held: 'hold',
  kept: 'keep',
  led: 'lead',
  made: 'make',
  met: 'meet',
  oversaw: 'oversee',
  overseen: 'oversee',
  ran: 'run',
  rebuilt: 'rebuild',
  rewrote: 'rewrite',
  rewritten: 'rewrite',
  sent: 'send',
  set: 'set',
  sold: 'sell',
  spent: 'spend',
  spoke: 'speak',
  sought: 'seek',
  taught: 'teach',
  took: 'take',
  taken: 'take',
  undertook: 'undertake',
  won: 'win',
  wrote: 'write',
  written: 'write',
};

const VERB_SET: ReadonlySet<string> = new Set(ACTION_VERBS);

/** Fast membership test over the base-form list (no suffix handling). */
export const ACTION_VERB_SET: ReadonlySet<string> = VERB_SET;

export interface WeakPhrase {
  /** Lowercase phrase as it appears at the start of a bullet. */
  phrase: string;
  /** What to write instead. */
  suggestion: string;
}

/**
 * Openers that describe duties instead of results. Ordered longest-first so
 * "was responsible for" wins over "responsible for".
 */
export const WEAK_STARTERS: readonly WeakPhrase[] = [
  { phrase: 'was responsible for', suggestion: 'Name the result: “Owned …”, “Led …”, “Ran …”' },
  { phrase: 'were responsible for', suggestion: 'Name the result: “Owned …”, “Led …”, “Ran …”' },
  { phrase: 'responsibilities included', suggestion: 'Replace the duty list with one achievement per bullet.' },
  { phrase: 'duties and responsibilities', suggestion: 'Replace the duty list with one achievement per bullet.' },
  { phrase: 'responsible for', suggestion: 'Start with the verb: “Owned …”, “Managed …”, “Directed …”' },
  { phrase: 'duties included', suggestion: 'Replace the duty list with one achievement per bullet.' },
  { phrase: 'tasks included', suggestion: 'Replace the task list with one achievement per bullet.' },
  { phrase: 'helped to', suggestion: 'Claim your part directly: “Built …”, “Delivered …”' },
  { phrase: 'helped with', suggestion: 'Claim your part directly: “Built …”, “Delivered …”' },
  { phrase: 'helped', suggestion: 'Claim your part directly: “Built …”, “Delivered …”' },
  { phrase: 'assisted with', suggestion: 'Say what you did: “Coordinated …”, “Prepared …”' },
  { phrase: 'assisted in', suggestion: 'Say what you did: “Coordinated …”, “Prepared …”' },
  { phrase: 'assisted', suggestion: 'Say what you did: “Coordinated …”, “Prepared …”' },
  { phrase: 'worked on', suggestion: 'Use the specific verb: “Developed …”, “Launched …”' },
  { phrase: 'worked with', suggestion: 'Use the specific verb: “Partnered with …”, “Advised …”' },
  { phrase: 'worked as', suggestion: 'Put the role in the job header and open with an achievement.' },
  { phrase: 'worked', suggestion: 'Use the specific verb: “Developed …”, “Launched …”' },
  { phrase: 'in charge of', suggestion: 'Start with the verb: “Directed …”, “Owned …”' },
  { phrase: 'tasked with', suggestion: 'Start with the verb and add the outcome.' },
  { phrase: 'participated in', suggestion: 'Name your contribution: “Drove …”, “Facilitated …”' },
  { phrase: 'involved in', suggestion: 'Name your contribution: “Drove …”, “Facilitated …”' },
  { phrase: 'part of', suggestion: 'Name your contribution rather than the team you sat on.' },
  { phrase: 'dealt with', suggestion: 'Use the specific verb: “Resolved …”, “Negotiated …”' },
  { phrase: 'familiar with', suggestion: 'Move tool familiarity to Skills; bullets are for results.' },
  { phrase: 'exposure to', suggestion: 'Move tool familiarity to Skills; bullets are for results.' },
  { phrase: 'contributed to', suggestion: 'State your own contribution: “Delivered …”, “Wrote …”' },
];

/** Filler that recruiters and ATS keyword screens both ignore. */
export const BUZZWORDS: readonly string[] = [
  'synergy',
  'synergies',
  'synergize',
  'hard worker',
  'hard-working',
  'hardworking',
  'team player',
  'detail-oriented',
  'detail oriented',
  'go-getter',
  'go getter',
  'self-starter',
  'self starter',
  'results-driven',
  'results driven',
  'think outside the box',
  'outside the box',
  'proven track record',
  'track record of success',
  'thought leader',
  'world-class',
  'best-in-class',
  'best in breed',
  'win-win',
  'low-hanging fruit',
  'move the needle',
  'wheelhouse',
  'value-add',
  'rockstar',
  'rock star',
  'ninja',
  'guru',
];

/** Uppercase "I" is a pronoun; lowercase "i" almost never is, so it is matched case-sensitively. */
const FIRST_PERSON_I_RE = /\bI\b/;
const FIRST_PERSON_RE = /\b(?:my|mine|myself|me|we|our|ours|ourselves)\b/i;

/** True when the text uses first-person pronouns ("I led", "my team", "we shipped"). */
export function hasFirstPerson(text: string): boolean {
  if (!text) return false;
  return FIRST_PERSON_I_RE.test(text) || FIRST_PERSON_RE.test(text);
}

/** The first-person pronouns present in `text`, lowercased and deduped, in order. */
export function firstPersonPronouns(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  if (FIRST_PERSON_I_RE.test(text)) {
    seen.add('i');
    out.push('I');
  }
  const matches = text.match(/\b(?:my|mine|myself|me|we|our|ours|ourselves)\b/gi);
  for (const match of matches ?? []) {
    const key = match.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function cleanWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z]+/, '')
    .replace(/[^a-z-]+$/, '');
}

/** Candidate base forms for an inflected verb, most likely first. */
function baseCandidates(word: string): string[] {
  const out: string[] = [word];
  if (word.endsWith('ied') && word.length > 4) out.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ed') && word.length > 3) {
    out.push(word.slice(0, -1));
    out.push(word.slice(0, -2));
    // "shipped" → "ship", "planned" → "plan"
    const stem = word.slice(0, -2);
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) out.push(stem.slice(0, -1));
  }
  if (word.endsWith('ing') && word.length > 4) {
    const stem = word.slice(0, -3);
    out.push(stem);
    out.push(`${stem}e`);
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) out.push(stem.slice(0, -1));
  }
  if (word.endsWith('ies') && word.length > 4) out.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('es') && word.length > 3) out.push(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) out.push(word.slice(0, -1));
  return out;
}

/**
 * The canonical base verb behind a word ("Migrated" → "migrate", "Led" → "lead"),
 * or `null` when the word is not a recognized action verb.
 */
export function actionVerbRoot(word: string): string | null {
  const clean = cleanWord(word ?? '');
  if (!clean) return null;
  const irregular = IRREGULAR_PAST_VERBS[clean];
  if (irregular) return irregular;
  for (const candidate of baseCandidates(clean)) {
    if (VERB_SET.has(candidate)) return candidate;
  }
  return null;
}

/** True when the word is a strong action verb in any common tense. */
export function isActionVerb(word: string): boolean {
  return actionVerbRoot(word) !== null;
}

/** Strip bullet glyphs, quotes and leading whitespace so the first real word is visible. */
export function stripBulletGlyph(text: string): string {
  return (text ?? '').replace(/^[\s ]*[•·◦‣▪▫▸►○●–—\-*+»]+[\s ]*/, '').replace(/^["'“”‘’]+/, '').trim();
}

/** The first word of a bullet, glyphs and punctuation removed. */
export function firstWordOf(text: string): string {
  const stripped = stripBulletGlyph(text);
  const match = /^[A-Za-z][A-Za-z'-]*/.exec(stripped);
  return match ? match[0] : '';
}

/**
 * The weak opener a bullet starts with, or `null`.
 * Matching ignores case, bullet glyphs and doubled spaces.
 */
export function weakStartMatch(text: string): WeakPhrase | null {
  const stripped = stripBulletGlyph(text).toLowerCase().replace(/\s+/g, ' ');
  if (!stripped) return null;
  for (const weak of WEAK_STARTERS) {
    if (stripped === weak.phrase) return weak;
    if (stripped.startsWith(`${weak.phrase} `)) return weak;
  }
  return null;
}

/** Buzzwords present in the text, deduped, in dictionary order. */
export function findBuzzwords(text: string): string[] {
  if (!text) return [];
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const out: string[] = [];
  for (const word of BUZZWORDS) {
    if (haystack.includes(` ${word} `) || haystack.includes(` ${word},`) || haystack.includes(` ${word}.`)) {
      out.push(word);
    }
  }
  return out;
}
