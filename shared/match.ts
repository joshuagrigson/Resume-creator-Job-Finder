/**
 * Resume ↔ job match scoring.
 *
 * Runs entirely client-side (the resume never leaves the browser) and is called thousands
 * of times per search, so everything here is pure, deterministic and allocation-light.
 * Dependency-free: no DOM, no Node APIs, no imports outside `shared/`.
 *
 * Weighted blend
 * --------------
 *   required-skill coverage   55 %
 *   title / headline overlap  20 %
 *   general keyword overlap   15 %
 *   nice-to-have coverage     10 %
 *
 * A component that cannot be computed (no requirements detected, empty description) is
 * dropped and its weight redistributed across the remaining components, so a job with a
 * bare title still gets an honest score instead of an artificial zero.
 */

import type { Job, MatchResult } from './types';
import { canonicalSkillFor, extractKeywords, extractRequirements, extractSkills, isCanonicalSkill } from './keywords';
import { normalizeText, tokenize } from './text';

export interface ResumeProfile {
  /** Canonical-where-possible skill names from the skills section plus the resume body. */
  skills: string[];
  /** Job titles held, most recent first. */
  titles: string[];
  /** The headline under the name, e.g. "Marketing Operations Manager". */
  headline: string;
  /** The whole resume as plain text, in reading order. */
  text: string;
  /** Total non-overlapping years of experience. */
  yearsExperience: number;
}

export type MatchTone = 'success' | 'info' | 'warning' | 'danger';
export type MatchLabelName = 'Excellent' | 'Strong' | 'Good' | 'Fair' | 'Low';

/** Job fields the matcher needs — anything `Job`-shaped works. */
export type MatchableJob = Pick<Job, 'title' | 'descriptionText' | 'tags' | 'category'>;

const WEIGHT_REQUIRED = 0.55;
const WEIGHT_TITLE = 0.2;
const WEIGHT_KEYWORDS = 0.15;
const WEIGHT_NICE = 0.1;

const MAX_MATCHED = 18;
const MAX_MISSING = 12;
const KEYWORD_SAMPLE = 24;

// ---------------------------------------------------------------------------
// Title similarity
// ---------------------------------------------------------------------------

/** Words that say *how senior*, not *what job*. Compared separately from the role words. */
const SENIORITY_RANK: Record<string, number> = {
  intern: 0,
  internship: 0,
  trainee: 0,
  apprentice: 0,
  entry: 1,
  junior: 1,
  jr: 1,
  ii: 3,
  mid: 3,
  intermediate: 3,
  senior: 4,
  sr: 4,
  snr: 4,
  iii: 4,
  lead: 5,
  staff: 5,
  iv: 5,
  supervising: 5,
  principal: 6,
  head: 6,
  chief: 6,
  vp: 6,
  director: 6,
};

/** Role words that mean roughly the same thing on a job board. */
const ROLE_SYNONYMS: Record<string, string> = {
  developer: 'engineer',
  dev: 'engineer',
  programmer: 'engineer',
  engineer: 'engineer',
  engineering: 'engineer',
  coder: 'engineer',
  coordinator: 'specialist',
  specialist: 'specialist',
  generalist: 'specialist',
  associate: 'associate',
  assistant: 'assistant',
  manager: 'manager',
  mgr: 'manager',
  supervisor: 'manager',
  administrator: 'admin',
  admin: 'admin',
  technician: 'technician',
  tech: 'technician',
  representative: 'representative',
  rep: 'representative',
  agent: 'representative',
  analyst: 'analyst',
  consultant: 'consultant',
  architect: 'architect',
  designer: 'designer',
  strategist: 'strategist',
  officer: 'manager',
  executive: 'manager',
};

/** Noise that appears in posting titles but carries no role meaning. */
const TITLE_NOISE = new Set([
  'the','of','and','or','for','with','to','in','at','on','a','an','new','our','we','you',
  'remote','hybrid','onsite','on-site','anywhere','worldwide','global','usa','us','uk','eu','emea','apac',
  'full','part','time','full-time','part-time','contract','contractor','temporary','permanent','freelance',
  'job','jobs','position','positions','role','roles','opening','openings','opportunity','hiring','urgent',
  'level','grade','band','team','department','division','group','inc','llc','ltd','gmbh',
  'm','f','d','x','w',
]);

interface TitleShape {
  role: Set<string>;
  rank: number | null;
}

function titleShape(title: string): TitleShape {
  const role = new Set<string>();
  let rank: number | null = null;
  for (const raw of tokenize(title)) {
    const seniority = SENIORITY_RANK[raw];
    if (seniority !== undefined) {
      // "Director" and "VP" are also the role; keep the highest seniority signal seen.
      if (rank === null || seniority > rank) rank = seniority;
      if (raw === 'director' || raw === 'vp' || raw === 'head' || raw === 'chief') role.add('director');
      continue;
    }
    if (TITLE_NOISE.has(raw)) continue;
    role.add(ROLE_SYNONYMS[raw] ?? raw);
  }
  return { role, rank };
}

function shapeSimilarity(job: TitleShape, mine: TitleShape): number {
  if (job.role.size === 0 || mine.role.size === 0) return 0;
  let intersection = 0;
  for (const token of job.role) if (mine.role.has(token)) intersection += 1;
  if (intersection === 0) return 0;
  const union = job.role.size + mine.role.size - intersection;
  const jaccard = intersection / union;
  const smaller = Math.min(job.role.size, mine.role.size);
  // Containment only counts when the smaller title has real substance; otherwise a
  // one-word "Manager" posting would perfectly match every manager resume.
  const containment = smaller >= 2 ? (intersection / smaller) * 0.9 : 0;
  const sim = Math.max(jaccard, containment);
  // A title with no seniority word sits at "mid"; every level of distance costs a little,
  // so an intern posting never outranks a peer-level one for the same discipline.
  const gap = Math.abs((job.rank ?? 3) - (mine.rank ?? 3));
  return gap === 0 ? sim : sim * Math.max(0.5, 1 - 0.08 * gap);
}

/** 0–1 similarity between a job title and the titles/headline on a resume. */
export function titleSimilarity(jobTitle: string, titles: readonly string[], headline = ''): number {
  const job = titleShape(jobTitle);
  if (job.role.size === 0) return 0;
  let best = 0;
  const candidates: string[] = [];
  if (headline) candidates.push(headline);
  for (const t of titles) if (t) candidates.push(t);
  for (const candidate of candidates) {
    const sim = shapeSimilarity(job, titleShape(candidate));
    if (sim > best) best = sim;
    if (best >= 1) break;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Compiled profile (memoized per profile object)
// ---------------------------------------------------------------------------

interface CompiledProfile {
  skillKeys: Set<string>;
  tokens: Set<string>;
  titles: string[];
  headline: string;
}

const PROFILE_CACHE = new WeakMap<ResumeProfile, CompiledProfile>();

function skillKey(name: string): string {
  return canonicalSkillFor(name)?.toLowerCase() ?? normalizeText(name);
}

function compileProfile(profile: ResumeProfile): CompiledProfile {
  const cached = PROFILE_CACHE.get(profile);
  if (cached) return cached;

  const skillKeys = new Set<string>();
  for (const skill of profile.skills ?? []) {
    const key = skillKey(skill);
    if (key) skillKeys.add(key);
  }
  // Catch skills written into bullets/summary but never listed in a skills section.
  for (const canonical of extractSkills(profile.text ?? '')) skillKeys.add(canonical.toLowerCase());

  const tokens = new Set<string>();
  const sources = [profile.text ?? '', profile.headline ?? '', (profile.titles ?? []).join(' '), (profile.skills ?? []).join(' ')];
  for (const source of sources) {
    for (const token of tokenize(source)) tokens.add(token);
  }

  const compiled: CompiledProfile = {
    skillKeys,
    tokens,
    titles: (profile.titles ?? []).filter(Boolean),
    headline: profile.headline ?? '',
  };
  PROFILE_CACHE.set(profile, compiled);
  return compiled;
}

function hasSkill(compiled: CompiledProfile, canonical: string): boolean {
  return compiled.skillKeys.has(canonical.toLowerCase());
}

function hasTerm(compiled: CompiledProfile, term: string): boolean {
  if (compiled.skillKeys.has(term.toLowerCase())) return true;
  const parts = tokenize(term);
  if (parts.length === 0) return false;
  for (const part of parts) if (!compiled.tokens.has(part)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** "call center" → "Call Center", for keyword-derived gaps that are not dictionary skills. */
function titleCase(term: string): string {
  return term.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items[0]} and ${items[1]}`;
}

/**
 * Score how well a resume profile matches a job. Deterministic: the same inputs always
 * produce the same `MatchResult`.
 */
export function scoreJobMatch(profile: ResumeProfile, job: MatchableJob): MatchResult {
  const compiled = compileProfile(profile);
  const description = job.descriptionText ?? '';
  const tags = Array.isArray(job.tags) ? job.tags : [];
  const title = job.title ?? '';
  const tagText = [job.category ?? '', ...tags].filter(Boolean).join(', ');

  const parsed = extractRequirements(description);
  const required: string[] = [...parsed.required];
  const requiredSeen = new Set(required);
  // Title/tags describe what the job is about, so treat them as requirements too —
  // this is what keeps scoring meaningful when a source gives us no description.
  for (const skill of extractSkills(tagText ? `${title}. ${tagText}` : title)) {
    if (requiredSeen.has(skill)) continue;
    requiredSeen.add(skill);
    required.push(skill);
  }
  const niceToHave = parsed.niceToHave.filter((skill) => !requiredSeen.has(skill));

  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];
  for (const skill of required) (hasSkill(compiled, skill) ? matchedRequired : missingRequired).push(skill);

  const matchedNice: string[] = [];
  const missingNice: string[] = [];
  for (const skill of niceToHave) (hasSkill(compiled, skill) ? matchedNice : missingNice).push(skill);

  const similarity = titleSimilarity(title, compiled.titles, compiled.headline);

  const keywordSource = description.trim() ? description : [title, tagText].filter(Boolean).join('. ');
  const keywords = extractKeywords(keywordSource, KEYWORD_SAMPLE);
  let keywordTotal = 0;
  let keywordHit = 0;
  const missingKeywords: string[] = [];
  for (const { term, count } of keywords) {
    keywordTotal += count;
    if (hasTerm(compiled, term)) {
      keywordHit += count;
      continue;
    }
    // Keywords that read like a skill: a dictionary name, or a repeated multi-word phrase
    // ("call center", "account management"). One-off word pairs are noise, not gaps.
    if (missingKeywords.length >= 4) continue;
    if (isCanonicalSkill(term)) missingKeywords.push(term);
    else if (term.includes(' ') && count >= 2) missingKeywords.push(titleCase(term));
  }
  const keywordOverlap = keywordTotal > 0 ? keywordHit / keywordTotal : null;

  const parts: { weight: number; value: number }[] = [];
  const requiredCoverage = required.length > 0 ? matchedRequired.length / required.length : null;
  if (requiredCoverage !== null) parts.push({ weight: WEIGHT_REQUIRED, value: requiredCoverage });
  if (niceToHave.length > 0) parts.push({ weight: WEIGHT_NICE, value: matchedNice.length / niceToHave.length });
  parts.push({ weight: WEIGHT_TITLE, value: similarity });
  if (keywordOverlap !== null) parts.push({ weight: WEIGHT_KEYWORDS, value: keywordOverlap });

  let weightSum = 0;
  let weighted = 0;
  for (const part of parts) {
    weightSum += part.weight;
    weighted += part.weight * part.value;
  }
  const raw = weightSum > 0 ? weighted / weightSum : 0;
  // With no detectable requirements we are scoring a title and a handful of words —
  // honest enough to rank with, not enough to call an excellent match.
  const ceiling = requiredCoverage === null ? 70 : 100;
  const score = Math.max(0, Math.min(ceiling, Math.round(raw * 100)));

  const matchedSkills = [...matchedRequired, ...matchedNice].slice(0, MAX_MATCHED);
  const missingSkills: string[] = [];
  const missingSeen = new Set<string>();
  for (const skill of [...missingRequired, ...missingNice, ...missingKeywords]) {
    if (missingSeen.has(skill)) continue;
    missingSeen.add(skill);
    missingSkills.push(skill);
    if (missingSkills.length >= MAX_MISSING) break;
  }

  const reasons: string[] = [];
  if (requiredCoverage !== null) {
    reasons.push(`${matchedRequired.length} of ${required.length} required skills`);
  } else {
    reasons.push('Few requirements detected');
  }
  if (similarity >= 0.6) reasons.push('Title matches your headline');
  else if (similarity >= 0.3) reasons.push('Close to titles you have held');
  else reasons.push('Different title from your experience');
  if (niceToHave.length > 0 && matchedNice.length > 0) {
    reasons.push(`${matchedNice.length} of ${niceToHave.length} preferred skills`);
  }
  if (reasons.length < 4 && missingSkills.length > 0) {
    reasons.push(`Missing ${joinList(missingSkills.slice(0, 2))}`);
  }

  return {
    score,
    matchedSkills,
    missingSkills,
    titleSimilarity: Math.round(similarity * 1000) / 1000,
    reasons: reasons.slice(0, 4),
  };
}

/** Bucket a 0–100 score into a label and a tone for badges. */
export function matchLabel(score: number): { label: MatchLabelName; tone: MatchTone } {
  const value = Number.isFinite(score) ? score : 0;
  if (value >= 85) return { label: 'Excellent', tone: 'success' };
  if (value >= 70) return { label: 'Strong', tone: 'success' };
  if (value >= 55) return { label: 'Good', tone: 'info' };
  if (value >= 40) return { label: 'Fair', tone: 'warning' };
  return { label: 'Low', tone: 'danger' };
}
