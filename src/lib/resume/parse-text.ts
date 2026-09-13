/**
 * Heuristic resume parser: pasted plain text → `Partial<Resume>`.
 *
 * It is deliberately forgiving. Real resumes arrive from PDF copy-paste with inconsistent
 * bullet glyphs, dates in five formats and headings in title case, ALL CAPS or with
 * trailing colons. The parser therefore works in three passes:
 *
 *  1. **Contact** — name, email, phone, links and "City, ST" from the top of the document
 *     (email/phone/links are also searched document-wide as a fallback).
 *  2. **Sections** — lines are matched against a heading vocabulary (summary, experience,
 *     education, skills, projects, certifications, awards…). Everything before the first
 *     heading is the header block.
 *  3. **Per-section parsing** — experience entries are anchored on lines that contain a
 *     date range; education on degree/school keywords; skills on separators.
 *
 * Nothing here throws: unparseable input simply yields fewer fields. Only non-empty
 * sections are returned, so the caller can merge with `createBlankResume()` safely.
 */

import type {
  CertificationItem,
  ContactInfo,
  CustomSection,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  Resume,
  SkillGroup,
} from '@shared/types';
import { uid } from '@/lib/id';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTH_NUMBERS: Readonly<Record<string, number>> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_SRC =
  '(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)';
const YEAR_SRC = '(?:19|20)\\d{2}';
/** Date *normalization* accepts a wider range than date *detection* does. */
const LOOSE_YEAR_SRC = '(?:1[5-9]|20)\\d{2}';
/** Ordered most specific first so "2019-03" beats a bare "2019". */
const DATE_SRC =
  `(?:${MONTH_SRC}\\.?\\s*,?\\s*${YEAR_SRC}` +
  `|\\d{1,2}\\s*[\\/.]\\s*\\d{1,2}\\s*[\\/.]\\s*\\d{2,4}` +
  `|\\d{1,2}\\s*[\\/.]\\s*${YEAR_SRC}` +
  `|${YEAR_SRC}\\s*[-\\/]\\s*(?:0[1-9]|1[0-2])` +
  `|${YEAR_SRC})`;
const PRESENT_SRC = '(?:present|current|currently|now|to date|to-date|ongoing|today)';
const RANGE_SEP_SRC = '\\s*(?:–|—|−|-|to|through|thru|until)\\s*';

const DATE_RANGE_RE = new RegExp(`(${DATE_SRC})${RANGE_SEP_SRC}(${DATE_SRC}|${PRESENT_SRC})`, 'i');
const PRESENT_RE = new RegExp(`^${PRESENT_SRC}$`, 'i');
const SINGLE_DATE_RE = new RegExp(DATE_SRC, 'i');

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Normalize any recognized date token to `"YYYY-MM"`.
 *
 * A bare year has no month, so `prefer` decides: `'start'` → January, `'end'` → December.
 * Returns `''` when nothing usable is found.
 */
export interface YearMonthOptions {
  /**
   * Skip the two unanchored last-resort branches (a month name or a bare year found
   * *anywhere* in the string). Callers that must not invent a month — free-text
   * certification dates such as "Valid through 2027" — pass true.
   */
  strict?: boolean;
}

export function toYearMonth(raw: string, prefer: 'start' | 'end' = 'start', options: YearMonthOptions = {}): string {
  const text = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  if (PRESENT_RE.test(text)) return '';

  const monthYear = new RegExp(`^(${MONTH_SRC})\\.?\\s*,?\\s*(${LOOSE_YEAR_SRC})$`, 'i').exec(text);
  if (monthYear) {
    const month = MONTH_NUMBERS[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${pad2(month)}`;
  }

  const isoish = new RegExp(`^(${LOOSE_YEAR_SRC})[-/](\\d{1,2})(?:[-/]\\d{1,2})?$`).exec(text);
  if (isoish) {
    const month = Number(isoish[2]);
    if (month >= 1 && month <= 12) return `${isoish[1]}-${pad2(month)}`;
  }

  const mdy = /^(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{2,4})$/.exec(text);
  if (mdy) {
    const month = Number(mdy[1]);
    const yearRaw = Number(mdy[3]);
    const year = yearRaw < 100 ? (yearRaw > 50 ? 1900 + yearRaw : 2000 + yearRaw) : yearRaw;
    if (month >= 1 && month <= 12) return `${year}-${pad2(month)}`;
  }

  const my = new RegExp(`^(\\d{1,2})\\s*[/.]\\s*(${LOOSE_YEAR_SRC})$`).exec(text);
  if (my) {
    const month = Number(my[1]);
    if (month >= 1 && month <= 12) return `${my[2]}-${pad2(month)}`;
  }

  const yearOnly = new RegExp(`^(${LOOSE_YEAR_SRC})$`).exec(text);
  if (yearOnly) return `${yearOnly[1]}-${prefer === 'end' ? '12' : '01'}`;

  if (options.strict) return '';

  // Last resort: a month name and a year anywhere in the string ("Spring, March 2021").
  const loose = new RegExp(`(${MONTH_SRC})\\.?\\s*,?\\s*(${LOOSE_YEAR_SRC})`, 'i').exec(text);
  if (loose) {
    const month = MONTH_NUMBERS[loose[1].toLowerCase()];
    if (month) return `${loose[2]}-${pad2(month)}`;
  }
  const anyYear = new RegExp(LOOSE_YEAR_SRC).exec(text);
  if (anyYear) return `${anyYear[0]}-${prefer === 'end' ? '12' : '01'}`;

  return '';
}

export interface DateRangeMatch {
  startDate: string;
  endDate: string;
  current: boolean;
  /** The matched text, so callers can remove it from the line. */
  text: string;
}

/** Find a `start – end` date range anywhere in a line. */
export function findDateRange(line: string): DateRangeMatch | null {
  const match = DATE_RANGE_RE.exec(line ?? '');
  if (!match) return null;
  const current = PRESENT_RE.test(match[2].trim());
  return {
    startDate: toYearMonth(match[1], 'start'),
    endDate: current ? '' : toYearMonth(match[2], 'end'),
    current,
    text: match[0],
  };
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

type SectionKind =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'custom';

const HEADINGS: ReadonlyArray<{ kind: SectionKind; titles: readonly string[] }> = [
  {
    kind: 'summary',
    titles: [
      'summary', 'professional summary', 'career summary', 'executive summary', 'profile',
      'professional profile', 'personal profile', 'objective', 'career objective', 'about',
      'about me', 'overview', 'highlights', 'career highlights', 'qualifications summary',
    ],
  },
  {
    kind: 'experience',
    titles: [
      'experience', 'work experience', 'professional experience', 'relevant experience',
      'employment', 'employment history', 'work history', 'career history', 'career experience',
      'professional background', 'work', 'positions held', 'relevant work experience',
    ],
  },
  {
    kind: 'education',
    titles: [
      'education', 'education and training', 'education & training', 'academic background',
      'academics', 'academic history', 'educational background', 'degrees',
    ],
  },
  {
    kind: 'skills',
    titles: [
      'skills', 'technical skills', 'core skills', 'key skills', 'core competencies',
      'competencies', 'areas of expertise', 'expertise', 'skills and abilities',
      'skills & abilities', 'technical proficiencies', 'proficiencies', 'technologies',
      'technology', 'tools', 'tools and technologies', 'software',
    ],
  },
  {
    kind: 'projects',
    titles: [
      'projects', 'personal projects', 'selected projects', 'key projects', 'side projects',
      'portfolio', 'notable projects',
    ],
  },
  {
    kind: 'certifications',
    titles: [
      'certifications', 'certification', 'certificates', 'licenses', 'licences',
      'certifications and licenses', 'certifications & licenses', 'licenses and certifications',
      'licenses & certifications', 'credentials', 'professional certifications',
    ],
  },
  {
    kind: 'custom',
    titles: [
      'awards', 'honors', 'honours', 'awards and honors', 'awards & honors', 'achievements',
      'accomplishments', 'activities', 'volunteer', 'volunteering', 'volunteer experience',
      'community involvement', 'publications', 'presentations', 'speaking', 'languages',
      'interests', 'hobbies', 'affiliations', 'memberships', 'professional affiliations',
      'additional information', 'additional', 'leadership', 'training', 'courses', 'coursework',
    ],
  },
];

const HEADING_LOOKUP = new Map<string, SectionKind>();
for (const group of HEADINGS) {
  for (const title of group.titles) HEADING_LOOKUP.set(title, group.kind);
}

function headingKey(line: string): string {
  return line
    .replace(/[^A-Za-z& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** The section a heading line introduces, or `null` when the line is body text. */
function matchHeading(line: string): { kind: SectionKind; title: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 48) return null;
  if (/^[-–—_=*•]+$/.test(trimmed)) return null;
  const key = headingKey(trimmed);
  if (!key) return null;
  const kind = HEADING_LOOKUP.get(key);
  if (!kind) return null;
  const title = trimmed.replace(/[:：]+\s*$/, '').trim();
  return { kind, title: title.length <= 3 ? title.toUpperCase() : titleCase(title) };
}

function titleCase(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length > 2 || word === 'it' ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Line utilities
// ---------------------------------------------------------------------------

const BULLET_GLYPH_RE = /^[\s]*([•·◦‣▪▫▸►○●※>»]|[-–—*+](?=\s))\s*/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}(?!\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s,|()<>]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,|()<>]+/i;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/[^\s,|()<>]*)?/;
const CITY_STATE_RE = /\b([A-Z][A-Za-z.'’-]+(?:[ -][A-Z][A-Za-z.'’-]+){0,3}),\s*([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?/;
const US_STATE_RE = /^[A-Z]{2}$/;

interface RawLine {
  /** Trimmed text. */
  text: string;
  /** Leading whitespace of the original line (used to detect indented bullets). */
  indent: number;
  /** True when the original line began with a bullet glyph. */
  glyph: boolean;
}

function splitLines(text: string): RawLine[] {
  const normalized = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/\t/g, '    ');
  const raws = normalized.split('\n');
  // Some exports indent the whole document; only indentation *relative* to the document
  // margin marks a bullet.
  let margin = Infinity;
  for (const raw of raws) {
    if (!raw.trim()) continue;
    margin = Math.min(margin, raw.length - raw.replace(/^\s+/, '').length);
  }
  if (!Number.isFinite(margin)) margin = 0;

  const out: RawLine[] = [];
  for (const raw of raws) {
    const glyph = BULLET_GLYPH_RE.test(raw);
    const withoutGlyph = glyph ? raw.replace(BULLET_GLYPH_RE, '') : raw;
    const indent = Math.max(0, raw.length - raw.replace(/^\s+/, '').length - margin);
    const trimmed = withoutGlyph.trim().replace(/\s{2,}/g, '  ');
    out.push({ text: trimmed, indent, glyph });
  }
  return out;
}

function isBulletLine(line: RawLine): boolean {
  return line.glyph || (line.indent >= 2 && line.text.length > 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Short, punctuation-free lines are headers (company/title); sentences are bullets. */
function looksLikeHeaderLine(text: string): boolean {
  if (!text) return false;
  if (text.length > 90) return false;
  if (wordCount(text) > 12) return false;
  if (/[.!?]$/.test(text) && !/\b[A-Z]\.$/.test(text)) return false;
  return true;
}

const STRONG_SEPARATOR_RE = /\s+(?:\||‖|—|–|·|•|∙|@)\s+|\s+-\s+|\s+at\s+|\s{2,}/i;

function splitHeaderAtoms(text: string): string[] {
  return text
    .split(STRONG_SEPARATOR_RE)
    .map((part) => part.replace(/^[\s,;|·•–—-]+|[\s,;|·•–—-]+$/g, '').trim())
    .filter(Boolean);
}

const TITLE_WORDS =
  /\b(manager|engineer|developer|director|analyst|specialist|coordinator|lead|head|chief|officer|consultant|designer|associate|intern|architect|administrator|representative|supervisor|president|founder|co-founder|owner|technician|nurse|teacher|instructor|driver|clerk|assistant|strategist|scientist|marketer|recruiter|accountant|chef|electrician|plumber|carpenter|welder|writer|editor|producer|agent|partner|principal|vp|svp|cto|ceo|cfo|coo|operator|planner|buyer|controller|paralegal|attorney|therapist|technologist|foreman|superintendent|dispatcher|cashier|server|barista|stylist|trainer|counselor|advisor|apprentice|journeyman|machinist|mechanic|inspector)\b/i;

const COMPANY_WORDS =
  /\b(inc\.?|llc|l\.l\.c\.|ltd\.?|limited|corp\.?|corporation|co\.|company|group|holdings|technologies|technology|media|solutions|resorts|labs|laboratories|systems|agency|agencies|partners|studio|studios|bank|health|healthcare|hospital|university|college|school|district|services|industries|enterprises|associates|consulting|capital|ventures|foundation|institute|networks|software|digital|logistics|foods|motors|energy|insurance|realty|properties)\b/i;

const LOCATION_RE = /^(?:remote|hybrid|on-?site|telecommute)\b/i;

/** Peel a trailing "City, ST" off an atom ("Kestrel Software, Dallas, TX"). */
function splitTrailingLocation(atom: string): { rest: string; location: string } {
  const match = CITY_STATE_RE.exec(atom);
  if (!match || match.index === undefined) return { rest: atom, location: '' };
  const end = match.index + match[0].length;
  if (end < atom.trim().length) return { rest: atom, location: '' };
  const rest = match.index === 0 ? '' : atom.slice(0, match.index).replace(/[\s,;|·•–—-]+$/, '').trim();
  return { rest, location: match[0].trim() };
}

function looksLikeLocation(atom: string): boolean {
  if (LOCATION_RE.test(atom)) return true;
  const match = CITY_STATE_RE.exec(atom);
  if (match && match[0].trim().length >= atom.trim().length - 1) return true;
  return /^[A-Z][A-Za-z .'’-]+,\s*[A-Z][A-Za-z .'’-]+$/.test(atom) && atom.split(',').length === 2 && US_STATE_RE.test(atom.split(',')[1].trim());
}

// ---------------------------------------------------------------------------
// Contact block
// ---------------------------------------------------------------------------

function parseContact(headerLines: RawLine[], wholeText: string): Partial<ContactInfo> {
  const contact: Partial<ContactInfo> = {};
  const texts = headerLines.map((line) => line.text).filter(Boolean);

  const email = EMAIL_RE.exec(wholeText);
  if (email) contact.email = email[0];

  const linkedin = LINKEDIN_RE.exec(wholeText);
  if (linkedin) contact.linkedin = linkedin[0].replace(/^https?:\/\//i, '').replace(/\/$/, '');

  const github = GITHUB_RE.exec(wholeText);
  if (github) contact.github = github[0].replace(/^https?:\/\//i, '').replace(/\/$/, '');

  // Phone: scan the header first so a phone number inside a bullet does not win.
  const headerJoined = texts.join('\n');
  const phone = PHONE_RE.exec(headerJoined) ?? PHONE_RE.exec(wholeText);
  if (phone) contact.phone = phone[0].trim();

  // Website: the first URL in the header that is not an email, LinkedIn or GitHub.
  for (const text of texts) {
    for (const piece of text.split(/[\s|·•,]+/)) {
      if (!piece || piece.includes('@')) continue;
      if (LINKEDIN_RE.test(piece) || GITHUB_RE.test(piece)) continue;
      const url = URL_RE.exec(piece);
      if (url && url[0].length === piece.length && /\.[A-Za-z]{2,}/.test(url[0])) {
        contact.website = url[0].replace(/^https?:\/\//i, '').replace(/\/$/, '');
        break;
      }
    }
    if (contact.website) break;
  }

  // Location: "City, ST" anywhere in the header block.
  for (const text of texts) {
    const match = CITY_STATE_RE.exec(text);
    if (match) {
      contact.location = `${match[1]}, ${match[2]}`;
      break;
    }
    if (LOCATION_RE.test(text) && text.length <= 40) {
      contact.location = text.replace(/[|·•,]\s*$/, '').trim();
      break;
    }
  }

  // Name: first line that reads like a person's name.
  let nameIndex = -1;
  for (let i = 0; i < texts.length; i++) {
    const candidate = texts[i].replace(/[|·•].*$/, '').trim();
    if (!candidate) continue;
    if (candidate.includes('@') || /\d/.test(candidate)) continue;
    if (!/[A-Za-z]/.test(candidate)) continue;
    if (matchHeading(candidate)) continue;
    const parts = candidate.split(/\s+/);
    if (parts.length === 0 || parts.length > 5) continue;
    if (candidate.length > 48) continue;
    if (/^(resume|curriculum vitae|cv)$/i.test(candidate)) continue;
    contact.fullName = candidate === candidate.toUpperCase() ? titleCase(candidate) : candidate;
    nameIndex = i;
    break;
  }

  // Headline: the next meaningful line after the name, when it is not contact data.
  if (nameIndex >= 0) {
    for (let i = nameIndex + 1; i < Math.min(texts.length, nameIndex + 3); i++) {
      const candidate = texts[i].trim();
      if (!candidate || candidate.length > 90) continue;
      if (candidate.includes('@')) continue;
      if (PHONE_RE.test(candidate)) continue;
      // A line with a date range is the first job entry, not a headline.
      if (findDateRange(candidate)) continue;
      if (URL_RE.test(candidate) && /(?:https?:\/\/|www\.|\.com|\.io|\.dev|\.net|\.org)/i.test(candidate)) continue;
      if (contact.location && candidate.includes(contact.location)) continue;
      if (CITY_STATE_RE.test(candidate) && wordCount(candidate) <= 4) continue;
      if (matchHeading(candidate)) continue;
      if (wordCount(candidate) > 12) continue;
      contact.headline = candidate.replace(/^[|·•\s-]+|[|·•\s-]+$/g, '');
      break;
    }
  }

  return contact;
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

interface ExperienceDraft {
  headerAtoms: string[];
  range: DateRangeMatch | null;
  bullets: string[];
}

function buildExperience(draft: ExperienceDraft): ExperienceItem | null {
  let atoms = draft.headerAtoms.flatMap(splitHeaderAtoms).filter(Boolean);
  const bullets = draft.bullets.map((b) => b.trim()).filter(Boolean);
  if (atoms.length === 0 && bullets.length === 0) return null;

  let location = '';
  const kept: string[] = [];
  for (const atom of atoms) {
    if (!location && looksLikeLocation(atom)) {
      location = atom;
      continue;
    }
    const split = splitTrailingLocation(atom);
    if (!location && split.location && split.rest) {
      location = split.location;
      kept.push(split.rest);
      continue;
    }
    kept.push(atom);
  }
  atoms = kept;

  // A single "Title, Company" atom still needs splitting.
  if (atoms.length === 1 && atoms[0].includes(',')) {
    const parts = atoms[0].split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2 && !US_STATE_RE.test(parts[1])) atoms = parts;
  }

  let title = '';
  let company = '';
  if (atoms.length === 1) {
    if (COMPANY_WORDS.test(atoms[0]) && !TITLE_WORDS.test(atoms[0])) company = atoms[0];
    else title = atoms[0];
  } else if (atoms.length >= 2) {
    const titleFirst = TITLE_WORDS.test(atoms[0]);
    const titleSecond = TITLE_WORDS.test(atoms[1]);
    if (titleFirst && !titleSecond) {
      title = atoms[0];
      company = atoms[1];
    } else if (!titleFirst && titleSecond) {
      title = atoms[1];
      company = atoms[0];
    } else if (COMPANY_WORDS.test(atoms[0]) && !COMPANY_WORDS.test(atoms[1])) {
      company = atoms[0];
      title = atoms[1];
    } else {
      title = atoms[0];
      company = atoms[1];
    }
    if (!location) {
      const extra = atoms.slice(2).find(looksLikeLocation);
      if (extra) location = extra;
    }
  }

  return {
    id: uid('exp'),
    company,
    title,
    location,
    startDate: draft.range?.startDate ?? '',
    endDate: draft.range?.endDate ?? '',
    current: draft.range?.current ?? false,
    bullets,
  };
}

function parseExperience(lines: RawLine[]): ExperienceItem[] {
  const drafts: ExperienceDraft[] = [];
  let current: ExperienceDraft | null = null;
  let pending: string[] = [];

  const flushPendingAsBullets = (): void => {
    if (!current || pending.length === 0) return;
    for (const text of pending) current.bullets.push(text);
    pending = [];
  };

  for (const line of lines) {
    if (!line.text) continue;

    if (isBulletLine(line)) {
      flushPendingAsBullets();
      if (!current) {
        current = { headerAtoms: [], range: null, bullets: [] };
        drafts.push(current);
      }
      current.bullets.push(line.text);
      continue;
    }

    const range = findDateRange(line.text);
    const remainder = range
      ? line.text
          .replace(range.text, ' ')
          .replace(/[([{]\s*[)\]}]/g, ' ')
          .replace(/[\s,;|·•–—-]+$/, '')
          .replace(/\s{2,}/g, '  ')
          .trim()
      : line.text;

    if (range && looksLikeHeaderLine(remainder)) {
      const headerAtoms = [...pending];
      if (remainder) headerAtoms.push(remainder);
      pending = [];
      current = { headerAtoms, range, bullets: [] };
      drafts.push(current);
      continue;
    }

    if (current && !looksLikeHeaderLine(line.text)) {
      // A sentence — this is a bullet without a glyph.
      flushPendingAsBullets();
      current.bullets.push(line.text);
      continue;
    }

    pending.push(line.text);
    // Only the last two short lines can plausibly head the next entry.
    while (pending.length > 2) {
      const oldest = pending.shift();
      if (oldest && current) current.bullets.push(oldest);
    }
  }

  if (pending.length > 0) {
    if (current) {
      flushPendingAsBullets();
    } else {
      drafts.push({ headerAtoms: [pending[0]], range: null, bullets: pending.slice(1) });
    }
  }

  const items: ExperienceItem[] = [];
  for (const draft of drafts) {
    const item = buildExperience(draft);
    if (item) items.push(item);
  }
  return items;
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

const DEGREE_RE =
  /\b(bachelor'?s?|bachelors|b\.?s\.?c?\.?|b\.?a\.?|b\.?b\.?a\.?|b\.?eng\.?|b\.?tech\.?|master'?s?|masters|m\.?s\.?c?\.?|m\.?a\.?|m\.?b\.?a\.?|m\.?eng\.?|ph\.?d\.?|doctorate|doctoral|j\.?d\.?|m\.?d\.?|d\.?d\.?s\.?|associate'?s?|a\.?a\.?s?\.?|a\.?s\.?|diploma|ged|high school|certificate)\b/i;
const SCHOOL_RE =
  /\b(university|universität|college|institute|polytechnic|academy|school|seminary|conservatory|community college)\b/i;
const GPA_RE = /\bgpa[:\s]*([0-4](?:\.\d{1,2})?)(?:\s*\/\s*[45](?:\.\d)?)?/i;

function parseEducation(lines: RawLine[]): EducationItem[] {
  const chunks: RawLine[][] = [];
  let chunk: RawLine[] = [];
  const startsEntry = (line: RawLine): boolean => {
    if (isBulletLine(line)) return false;
    return SCHOOL_RE.test(line.text) || DEGREE_RE.test(line.text);
  };

  for (const line of lines) {
    if (!line.text) continue;
    if (startsEntry(line) && chunk.length > 0) {
      const hasSchool = chunk.some((l) => SCHOOL_RE.test(l.text));
      const hasDegree = chunk.some((l) => DEGREE_RE.test(l.text));
      const addsSchool = SCHOOL_RE.test(line.text);
      const addsDegree = DEGREE_RE.test(line.text);
      // Start a new entry only once the current one already has what this line brings.
      if ((addsSchool && hasSchool) || (addsDegree && hasDegree) || (hasSchool && hasDegree)) {
        chunks.push(chunk);
        chunk = [];
      }
    }
    chunk.push(line);
  }
  if (chunk.length > 0) chunks.push(chunk);

  const items: EducationItem[] = [];
  for (const group of chunks) {
    const details: string[] = [];
    let school = '';
    let degree = '';
    let field = '';
    let location = '';
    let gpa = '';
    let startDate = '';
    let endDate = '';

    for (const line of group) {
      if (isBulletLine(line)) {
        details.push(line.text);
        continue;
      }
      let text = line.text;

      const gpaMatch = GPA_RE.exec(text);
      if (gpaMatch && !gpa) {
        gpa = gpaMatch[1];
        text = text.replace(gpaMatch[0], ' ').trim();
      }

      const range = findDateRange(text);
      if (range) {
        if (!startDate) startDate = range.startDate;
        if (!endDate) endDate = range.endDate;
        text = text.replace(range.text, ' ').trim();
      } else if (!endDate) {
        const single = SINGLE_DATE_RE.exec(text);
        if (single) {
          endDate = toYearMonth(single[0], 'end');
          text = text.replace(single[0], ' ').trim();
        }
      }

      // "University of Texas at Austin" must survive, so education never splits on " at ";
      // commas do separate degree / school / city instead.
      const cityMatch = CITY_STATE_RE.exec(text);
      if (cityMatch && !location) {
        location = `${cityMatch[1]}, ${cityMatch[2]}`;
        text = text.replace(cityMatch[0], ' ').trim();
      }
      const atoms = text
        .split(/\s+(?:\||‖|—|–|·|•|∙)\s+|\s+-\s+|\s{2,}|,/)
        .map((part) => part.replace(/^[\s,;|·•–—-]+|[\s,;|·•–—-]+$/g, '').trim())
        .filter(Boolean);

      for (const atom of atoms) {
        if (!atom) continue;
        if (!location && looksLikeLocation(atom)) {
          location = atom;
          continue;
        }
        if (!degree && DEGREE_RE.test(atom)) {
          const inMatch = /\s+(?:in|of)\s+/i.exec(atom);
          if (inMatch) {
            degree = atom.slice(0, inMatch.index).replace(/[,\s]+$/, '').trim();
            field = atom.slice(inMatch.index + inMatch[0].length).trim();
          } else if (atom.includes(',')) {
            const [first, ...rest] = atom.split(',');
            degree = first.trim();
            field = rest.join(',').trim();
          } else {
            degree = atom.trim();
          }
          continue;
        }
        if (!school && SCHOOL_RE.test(atom)) {
          school = atom;
          continue;
        }
        if (!field && degree && atom.length <= 60) {
          field = atom;
          continue;
        }
        if (!school && atom.length <= 70) {
          school = atom;
          continue;
        }
        details.push(atom);
      }
    }

    if (!school && !degree && !field && details.length === 0) continue;
    items.push({
      id: uid('edu'),
      school,
      degree,
      field,
      location,
      startDate,
      endDate,
      gpa,
      details,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const SKILL_SPLIT_RE = /[,;|•·∙‣]|\s{2,}|\s+\/\s+/;

function splitSkillList(text: string): string[] {
  return text
    .split(SKILL_SPLIT_RE)
    .map((part) => part.replace(/^[\s.&-]+|[\s.&-]+$/g, '').trim())
    .filter((part) => part.length > 0 && part.length <= 48);
}

function parseSkills(lines: RawLine[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  const loose: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (target: string[], skill: string): void => {
    const key = skill.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    target.push(skill);
  };

  for (const line of lines) {
    if (!line.text) continue;
    const colon = line.text.indexOf(':');
    if (colon > 0 && colon <= 44 && wordCount(line.text.slice(0, colon)) <= 5) {
      const name = line.text.slice(0, colon).trim();
      const skills: string[] = [];
      for (const skill of splitSkillList(line.text.slice(colon + 1))) pushUnique(skills, skill);
      if (skills.length > 0) {
        groups.push({ id: uid('skl'), name, skills });
        continue;
      }
    }
    for (const skill of splitSkillList(line.text)) pushUnique(loose, skill);
  }

  if (loose.length > 0) {
    groups.push({ id: uid('skl'), name: groups.length > 0 ? 'Additional' : 'Skills', skills: loose });
  }
  return groups.filter((group) => group.skills.length > 0);
}

// ---------------------------------------------------------------------------
// Projects & certifications
// ---------------------------------------------------------------------------

const TECH_PREFIX_RE = /^(?:tech(?:nologies)?|stack|tools|built with|using)\s*:\s*/i;

function parseProjects(lines: RawLine[]): ProjectItem[] {
  const items: ProjectItem[] = [];
  let current: ProjectItem | null = null;

  for (const line of lines) {
    if (!line.text) continue;
    const tech = TECH_PREFIX_RE.exec(line.text);
    if (tech && current) {
      current.technologies = splitSkillList(line.text.slice(tech[0].length));
      continue;
    }
    if (isBulletLine(line) && current) {
      current.bullets.push(line.text);
      continue;
    }
    if (!current || looksLikeHeaderLine(line.text)) {
      const range = findDateRange(line.text);
      const headerText = range ? line.text.replace(range.text, " ") : line.text;
      const atoms = splitHeaderAtoms(headerText);
      const urlAtom = atoms.find((atom) => URL_RE.test(atom) && /\.[A-Za-z]{2,}/.test(atom) && !atom.includes(' '));
      const name = atoms.find((atom) => atom !== urlAtom) ?? line.text;
      current = {
        id: uid('prj'),
        name: name.trim(),
        url: urlAtom ? urlAtom.replace(/^https?:\/\//i, '') : '',
        description: '',
        bullets: [],
        technologies: [],
      };
      items.push(current);
      continue;
    }
    if (!current.description) current.description = line.text;
    else current.bullets.push(line.text);
  }
  return items.filter((item) => item.name);
}

function parseCertifications(lines: RawLine[]): CertificationItem[] {
  const items: CertificationItem[] = [];
  for (const line of lines) {
    if (!line.text) continue;
    let text = line.text;
    let date = '';
    const range = findDateRange(text);
    if (range) {
      date = range.current ? '' : range.endDate || range.startDate;
      text = text.replace(range.text, ' ').trim();
    } else {
      const single = SINGLE_DATE_RE.exec(text);
      if (single) {
        // `CertificationItem.date` allows free text, so a year-only credential keeps the
        // year rather than inventing a month.
        date = /^(?:19|20)\d{2}$/.test(single[0].trim()) ? single[0].trim() : toYearMonth(single[0], 'end');
        text = text.replace(single[0], ' ').trim();
      }
    }
    const atoms = splitHeaderAtoms(text.replace(/[(),]+$/, ''));
    if (atoms.length === 0) continue;
    const urlAtom = atoms.find((atom) => /^(?:https?:\/\/|www\.)/i.test(atom));
    const rest = atoms.filter((atom) => atom !== urlAtom);
    const name = (rest[0] ?? '').replace(/[,\s]+$/, '');
    if (!name) continue;
    items.push({
      id: uid('crt'),
      name,
      issuer: (rest[1] ?? '').replace(/[,\s]+$/, ''),
      date,
      url: urlAtom ? urlAtom.replace(/^https?:\/\//i, '') : '',
    });
  }
  return items;
}

function parseCustomSection(title: string, lines: RawLine[]): CustomSection | null {
  const bullets: string[] = [];
  for (const line of lines) {
    if (!line.text) continue;
    bullets.push(line.text);
  }
  if (bullets.length === 0) return null;
  return {
    id: uid('sec'),
    title,
    items: [{ id: uid('itm'), heading: '', subheading: '', date: '', bullets }],
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

interface Block {
  kind: SectionKind;
  title: string;
  lines: RawLine[];
}

/**
 * Parse pasted resume text into the parts of a `Resume` we could recognize.
 *
 * Only keys with content are returned, so `{ ...createBlankResume(), ...parseResumeText(t) }`
 * never wipes a field with an empty value.
 */
export function parseResumeText(text: string): Partial<Resume> {
  const source = String(text ?? '');
  if (!source.trim()) return {};

  const lines = splitLines(source);
  const header: RawLine[] = [];
  const blocks: Block[] = [];
  let block: Block | null = null;

  for (const line of lines) {
    const heading = line.text && !isBulletLine(line) ? matchHeading(line.text) : null;
    if (heading) {
      block = { kind: heading.kind, title: heading.title, lines: [] };
      blocks.push(block);
      continue;
    }
    if (block) block.lines.push(line);
    else header.push(line);
  }

  const result: Partial<Resume> = {};

  const contact = parseContact(header, source);
  if (Object.values(contact).some((value) => (value ?? '').length > 0)) {
    result.contact = {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
      github: '',
      ...contact,
    };
  }

  const experience: ExperienceItem[] = [];
  const education: EducationItem[] = [];
  const skillGroups: SkillGroup[] = [];
  const projects: ProjectItem[] = [];
  const certifications: CertificationItem[] = [];
  const customSections: CustomSection[] = [];
  const summaryParts: string[] = [];

  for (const current of blocks) {
    const body = current.lines.filter((line) => line.text.length > 0);
    if (body.length === 0) continue;
    switch (current.kind) {
      case 'summary':
        summaryParts.push(body.map((line) => line.text).join(' '));
        break;
      case 'experience':
        experience.push(...parseExperience(current.lines));
        break;
      case 'education':
        education.push(...parseEducation(current.lines));
        break;
      case 'skills':
        skillGroups.push(...parseSkills(body));
        break;
      case 'projects':
        projects.push(...parseProjects(current.lines));
        break;
      case 'certifications':
        certifications.push(...parseCertifications(body));
        break;
      default: {
        const section = parseCustomSection(current.title, body);
        if (section) customSections.push(section);
        break;
      }
    }
  }

  // No headings at all: treat the body below the contact block as experience.
  if (blocks.length === 0 && header.length > 0) {
    const skip = new Set<string>(
      [contact.fullName, contact.headline, contact.email, contact.phone, contact.location].filter(Boolean) as string[],
    );
    const body = header.filter((line) => line.text && ![...skip].some((value) => line.text.includes(value)));
    experience.push(...parseExperience(body));
  }

  // A paragraph sitting in the header with no heading is almost always the summary.
  if (summaryParts.length === 0 && blocks.length > 0) {
    const headerIndex = header.findIndex((line) => wordCount(line.text) >= 18 && !line.text.includes('@'));
    if (headerIndex >= 0) {
      summaryParts.push(
        header
          .slice(headerIndex)
          .map((line) => line.text)
          .filter(Boolean)
          .join(' '),
      );
    }
  }

  const summary = summaryParts.join(' ').replace(/\s{2,}/g, ' ').trim();
  if (summary) result.summary = summary;
  if (experience.length > 0) result.experience = experience;
  if (education.length > 0) result.education = education;
  if (skillGroups.length > 0) result.skillGroups = skillGroups;
  if (projects.length > 0) result.projects = projects;
  if (certifications.length > 0) result.certifications = certifications;
  if (customSections.length > 0) result.customSections = customSections;

  return result;
}
