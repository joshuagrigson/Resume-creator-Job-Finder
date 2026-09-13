/**
 * Heuristic ATS analysis for a `Resume`.
 *
 * `analyzeResume(resume, jobText?)` is pure and deterministic — the same resume always
 * produces the same report — and fast enough to run on every keystroke in the editor.
 *
 * Scoring model
 * -------------
 * Every check that fails produces an {@link AtsIssue} with a concrete `fix` and an
 * `impact` in points. The overall score is `100 − Σ impact`, clamped to 0–100, so the
 * numbers a user sees always add up. Each category's score is `100 − (its impacts ÷ its
 * weight × 100)`.
 *
 * Category weights: Contact 15, Summary 10, Experience 30, Skills 15, Education 5,
 * Formatting 10, Keywords 15. Without a job description the Keywords category is dropped
 * and its 15 points are redistributed proportionally across the rest (impacts are scaled
 * by the same factor so the 0–100 scale is preserved).
 */

import type { AtsCategoryScore, AtsIssue, AtsReport, AtsSeverity, ExperienceItem, Resume } from '@shared/types';
import { extractRequirements, extractSkills } from '@shared/keywords';
import { resumeToPlainText } from '@/lib/resume/profile';
import {
  actionVerbRoot,
  findBuzzwords,
  firstPersonPronouns,
  firstWordOf,
  stripBulletGlyph,
  weakStartMatch,
} from '@/lib/resume/action-verbs';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

type CategoryId = 'contact' | 'summary' | 'experience' | 'skills' | 'education' | 'formatting' | 'keywords';

interface CategoryDef {
  id: CategoryId;
  label: string;
  weight: number;
}

const CATEGORY_DEFS: readonly CategoryDef[] = [
  { id: 'contact', label: 'Contact & headers', weight: 15 },
  { id: 'summary', label: 'Summary', weight: 10 },
  { id: 'experience', label: 'Experience quality', weight: 30 },
  { id: 'skills', label: 'Skills', weight: 15 },
  { id: 'education', label: 'Education & certifications', weight: 5 },
  { id: 'formatting', label: 'Formatting & length', weight: 10 },
  { id: 'keywords', label: 'Keywords vs job', weight: 15 },
];

/** Words of dense resume prose that fit on one printed page. */
export const WORDS_PER_PAGE = 550;

/** Recommended bullets per role. */
export const BULLETS_PER_ROLE = { min: 3, max: 6 } as const;

/** Recommended bullet length in words. */
export const BULLET_WORDS = { min: 8, max: 30 } as const;

/** Recommended summary length in words. */
export const SUMMARY_WORDS = { min: 30, max: 90 } as const;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

interface RawIssue {
  id: string;
  severity: AtsSeverity;
  area: CategoryId;
  message: string;
  fix: string;
  /** Points before keyword redistribution. */
  raw: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
/** A number, percentage, currency amount or "3x" multiplier anywhere in the bullet. */
const QUANTIFIED_RE = /\d|[%$€£¥]/;

function words(text: string): string[] {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).filter(Boolean);
}

function wordCountOf(text: string): number {
  return words(text).length;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function monthIndex(date: string): number | null {
  const match = MONTH_RE.exec((date ?? '').trim());
  if (!match) return null;
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
}

function list(items: readonly string[], limit = 3): string {
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  const joined = shown.join(', ');
  return rest > 0 ? `${joined} (+${rest} more)` : joined;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

/** A role counts as real once it has a company, a title or any bullet text. */
function isMeaningfulRole(item: ExperienceItem): boolean {
  if ((item.company ?? '').trim() || (item.title ?? '').trim()) return true;
  return (item.bullets ?? []).some((b) => b.trim().length > 0);
}

function cleanBullets(item: { bullets?: string[] }): string[] {
  return (item.bullets ?? []).map((b) => stripBulletGlyph(b)).filter((b) => b.length > 0);
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

interface BulletInfo {
  text: string;
  wordCount: number;
  quantified: boolean;
  verbRoot: string | null;
  weak: boolean;
  allCaps: boolean;
  pronouns: string[];
}

function describeBullet(text: string): BulletInfo {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return {
    text,
    wordCount: wordCountOf(text),
    quantified: QUANTIFIED_RE.test(text),
    verbRoot: actionVerbRoot(firstWordOf(text)),
    weak: weakStartMatch(text) !== null,
    allCaps: letters.length >= 8 && letters === letters.toUpperCase(),
    pronouns: firstPersonPronouns(text),
  };
}

export function analyzeResume(resume: Resume, jobText?: string): AtsReport {
  const issues: RawIssue[] = [];
  const strengths: string[] = [];
  const add = (issue: RawIssue): void => {
    if (issue.raw > 0) issues.push(issue);
  };

  const contact = resume?.contact ?? {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    linkedin: '',
    github: '',
  };
  const roles = (resume?.experience ?? []).filter(isMeaningfulRole);
  const plainText = resume ? resumeToPlainText(resume) : '';
  const totalWords = wordCountOf(plainText);
  const estimatedPagesExact = totalWords / WORDS_PER_PAGE;
  const estimatedPages = Math.round(estimatedPagesExact * 10) / 10;

  // -- Contact -------------------------------------------------------------
  const fullName = (contact.fullName ?? '').trim();
  const email = (contact.email ?? '').trim();
  const phone = (contact.phone ?? '').trim();
  const location = (contact.location ?? '').trim();
  const headline = (contact.headline ?? '').trim();

  if (!fullName) {
    add({
      id: 'contact.name-missing',
      severity: 'critical',
      area: 'contact',
      message: 'No name on the resume.',
      fix: 'Add your full name at the top — parsers use it as the applicant record key.',
      raw: 5,
    });
  }
  if (!email) {
    add({
      id: 'contact.email-missing',
      severity: 'critical',
      area: 'contact',
      message: 'No email address.',
      fix: 'Add a professional email (firstname.lastname@…). Recruiters reply there first.',
      raw: 4,
    });
  } else if (!EMAIL_RE.test(email)) {
    add({
      id: 'contact.email-format',
      severity: 'critical',
      area: 'contact',
      message: `"${email}" does not look like a valid email address.`,
      fix: 'Use the plain form name@domain.com — no spaces, no "mailto:", no display name.',
      raw: 4,
    });
  }
  if (!phone) {
    add({
      id: 'contact.phone-missing',
      severity: 'warning',
      area: 'contact',
      message: 'No phone number.',
      fix: 'Add a direct number, e.g. (903) 555-0142. Many screens filter out records without one.',
      raw: 2,
    });
  }
  if (!location) {
    add({
      id: 'contact.location-missing',
      severity: 'warning',
      area: 'contact',
      message: 'No location.',
      fix: 'Add "City, ST" or "Remote (US)" so location filters can match you.',
      raw: 2,
    });
  }
  if (!headline) {
    add({
      id: 'contact.headline-missing',
      severity: 'tip',
      area: 'contact',
      message: 'No professional headline under your name.',
      fix: 'Add the title you are targeting, e.g. "Marketing Operations Manager".',
      raw: 2,
    });
  }
  if (fullName && email && EMAIL_RE.test(email) && phone && location) {
    strengths.push('Contact block is complete and machine-readable.');
  }

  // -- Summary -------------------------------------------------------------
  const summary = (resume?.summary ?? '').trim();
  const summaryWords = wordCountOf(summary);
  if (!summary) {
    add({
      id: 'summary.missing',
      severity: 'warning',
      area: 'summary',
      message: 'No professional summary.',
      fix: `Write ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} words covering your role, years of experience and two measurable wins.`,
      raw: 7,
    });
  } else {
    if (summaryWords < SUMMARY_WORDS.min) {
      add({
        id: 'summary.too-short',
        severity: 'tip',
        area: 'summary',
        message: `Summary is ${summaryWords} ${plural(summaryWords, 'word')} — too thin to carry keywords.`,
        fix: `Expand to ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} words and name the tools and outcomes you want to be found for.`,
        raw: 2,
      });
    } else if (summaryWords > SUMMARY_WORDS.max) {
      add({
        id: 'summary.too-long',
        severity: 'tip',
        area: 'summary',
        message: `Summary is ${summaryWords} words — recruiters skim the first two lines.`,
        fix: `Cut it to ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} words; move the detail into experience bullets.`,
        raw: 2,
      });
    }
    const summaryPronouns = firstPersonPronouns(summary);
    if (summaryPronouns.length > 0) {
      add({
        id: 'summary.first-person',
        severity: 'warning',
        area: 'summary',
        message: `Summary is written in the first person (${list(summaryPronouns)}).`,
        fix: 'Drop the pronouns: "I manage a 14-rep call center" → "Manages a 14-rep call center".',
        raw: 3,
      });
    }
    if (summaryWords >= SUMMARY_WORDS.min && summaryWords <= SUMMARY_WORDS.max && summaryPronouns.length === 0) {
      strengths.push(`Summary is ${summaryWords} words and written in the third person.`);
    }
  }

  // -- Experience ----------------------------------------------------------
  const roleBullets = roles.map((role) => cleanBullets(role).map(describeBullet));
  const expBullets = roleBullets.flat();

  if (roles.length === 0) {
    add({
      id: 'experience.none',
      severity: 'critical',
      area: 'experience',
      message: 'No work experience listed.',
      fix: 'Add at least one role with a title, company, dates and 3–6 achievement bullets.',
      raw: 30,
    });
  } else {
    const thinRoles = roles.filter((_, i) => roleBullets[i].length < 2);
    const lightRoles = roles.filter((_, i) => roleBullets[i].length >= 2 && roleBullets[i].length < BULLETS_PER_ROLE.min);
    const heavyRoles = roles.filter((_, i) => roleBullets[i].length > BULLETS_PER_ROLE.max + 1);

    if (thinRoles.length > 0) {
      add({
        id: 'experience.too-few-bullets',
        severity: 'warning',
        area: 'experience',
        message: `${thinRoles.length} ${plural(thinRoles.length, 'role has', 'roles have')} fewer than 2 bullets (${list(
          thinRoles.map((r) => r.title || r.company || 'Untitled role'),
        )}).`,
        fix: `Give every role ${BULLETS_PER_ROLE.min}–${BULLETS_PER_ROLE.max} bullets — what you owned, what changed, by how much.`,
        raw: Math.min(6, thinRoles.length * 3),
      });
    }
    if (lightRoles.length > 0) {
      add({
        id: 'experience.light-bullets',
        severity: 'tip',
        area: 'experience',
        message: `${lightRoles.length} ${plural(lightRoles.length, 'role', 'roles')} could use another bullet or two.`,
        fix: `Aim for ${BULLETS_PER_ROLE.min}–${BULLETS_PER_ROLE.max} bullets per role, most recent role longest.`,
        raw: Math.min(2, lightRoles.length),
      });
    }
    if (heavyRoles.length > 0) {
      add({
        id: 'experience.too-many-bullets',
        severity: 'tip',
        area: 'experience',
        message: `${heavyRoles.length} ${plural(heavyRoles.length, 'role has', 'roles have')} more than ${
          BULLETS_PER_ROLE.max + 1
        } bullets.`,
        fix: `Keep the ${BULLETS_PER_ROLE.max} strongest bullets per role; older roles can drop to 2–3.`,
        raw: Math.min(2, heavyRoles.length),
      });
    }

    const weakBullets = expBullets.filter((b) => b.weak);
    const nonVerbBullets = expBullets.filter((b) => !b.weak && b.verbRoot === null);
    if (weakBullets.length > 0) {
      const weakest = weakStartMatch(weakBullets[0].text);
      add({
        id: 'experience.weak-verbs',
        severity: 'warning',
        area: 'experience',
        message: `${weakBullets.length} ${plural(weakBullets.length, 'bullet')} open with duty language such as "${
          weakest?.phrase ?? 'responsible for'
        }".`,
        fix: weakest?.suggestion ?? 'Open every bullet with a strong past-tense verb and finish with the result.',
        raw: Math.min(6, weakBullets.length * 2),
      });
    }
    if (nonVerbBullets.length > 0) {
      add({
        id: 'experience.no-action-verb',
        severity: nonVerbBullets.length > expBullets.length / 2 ? 'warning' : 'tip',
        area: 'experience',
        message: `${nonVerbBullets.length} of ${expBullets.length} ${plural(
          expBullets.length,
          'bullet does',
          'bullets do',
        )} not start with an action verb (e.g. "${nonVerbBullets[0].text.slice(0, 48)}…").`,
        fix: 'Start each bullet with a verb: Led, Built, Automated, Reduced, Negotiated, Launched.',
        raw: Math.min(5, nonVerbBullets.length),
      });
    }

    const quantified = expBullets.filter((b) => b.quantified).length;
    const quantRatio = expBullets.length > 0 ? quantified / expBullets.length : 0;
    if (expBullets.length > 0 && quantRatio < 0.5) {
      const missing = expBullets.length - quantified;
      add({
        id: 'experience.not-quantified',
        severity: quantified === 0 ? 'critical' : 'warning',
        area: 'experience',
        message: `Only ${quantified} of ${expBullets.length} bullets contain a number, percentage or dollar amount.`,
        fix: 'Add scale or delta to at least half your bullets: team size, volume, %, $, time saved.',
        raw: quantified === 0 ? 6 : Math.min(6, Math.round(missing / 2) + 1),
      });
    }

    const badLength = expBullets.filter(
      (b) => b.wordCount < BULLET_WORDS.min || b.wordCount > BULLET_WORDS.max,
    );
    if (badLength.length > 0) {
      const tooLong = badLength.filter((b) => b.wordCount > BULLET_WORDS.max).length;
      add({
        id: 'experience.bullet-length',
        severity: 'tip',
        area: 'experience',
        message: `${badLength.length} ${plural(badLength.length, 'bullet is', 'bullets are')} outside the ${
          BULLET_WORDS.min
        }–${BULLET_WORDS.max} word sweet spot (${tooLong} too long, ${badLength.length - tooLong} too short).`,
        fix: `Rewrite to ${BULLET_WORDS.min}–${BULLET_WORDS.max} words: action, object, result, metric.`,
        raw: Math.min(3, Math.ceil(badLength.length / 2)),
      });
    }

    const badDates = roles.filter((role) => {
      if (monthIndex(role.startDate) === null) return true;
      if (role.current) return false;
      return monthIndex(role.endDate) === null;
    });
    if (badDates.length > 0) {
      add({
        id: 'experience.dates',
        severity: 'warning',
        area: 'experience',
        message: `${badDates.length} ${plural(badDates.length, 'role is', 'roles are')} missing valid start/end dates (${list(
          badDates.map((r) => r.title || r.company || 'Untitled role'),
        )}).`,
        fix: 'Set every role to month precision (YYYY-MM) and tick "Current" for your present job.',
        raw: Math.min(4, badDates.length * 2),
      });
    }

    const dated = roles
      .map((role) => ({ role, start: monthIndex(role.startDate), end: role.current ? Number.MAX_SAFE_INTEGER : monthIndex(role.endDate) }))
      .filter((entry): entry is { role: ExperienceItem; start: number; end: number } => entry.start !== null && entry.end !== null);

    let outOfOrder = false;
    for (let i = 1; i < dated.length; i++) {
      if (dated[i].start > dated[i - 1].start) {
        outOfOrder = true;
        break;
      }
    }
    if (outOfOrder) {
      add({
        id: 'experience.order',
        severity: 'warning',
        area: 'experience',
        message: 'Roles are not in reverse-chronological order.',
        fix: 'Put the most recent role first — every ATS and recruiter reads top-down.',
        raw: 3,
      });
    }

    const sorted = [...dated].sort((a, b) => b.start - a.start);
    const gaps: string[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const newer = sorted[i - 1];
      const older = sorted[i];
      if (older.end === Number.MAX_SAFE_INTEGER) continue;
      const gap = newer.start - older.end - 1;
      if (gap > 12) {
        gaps.push(`${Math.round(gap / 12 * 10) / 10} years before ${newer.role.title || newer.role.company || 'a role'}`);
      }
    }
    if (gaps.length > 0) {
      add({
        id: 'experience.gaps',
        severity: 'tip',
        area: 'experience',
        message: `Employment ${plural(gaps.length, 'gap')} over 12 months: ${list(gaps, 2)}.`,
        fix: 'Cover the gap with contract work, study, caregiving or a short "Career break" entry — unexplained gaps get flagged.',
        raw: Math.min(2, gaps.length),
      });
    }

    const currentRoles = roles.filter((role) => role.current);
    const emptyCurrent = currentRoles.filter((role) => cleanBullets(role).length === 0);
    if (emptyCurrent.length > 0) {
      add({
        id: 'experience.current-empty',
        severity: 'critical',
        area: 'experience',
        message: `Your current role (${emptyCurrent[0].title || emptyCurrent[0].company || 'untitled'}) has no bullets.`,
        fix: 'The present role carries the most weight — add 4–6 achievement bullets there first.',
        raw: 4,
      });
    }

    if (expBullets.length > 0 && weakBullets.length === 0 && nonVerbBullets.length === 0) {
      strengths.push('Every experience bullet starts with a strong action verb.');
    }
    if (quantRatio >= 0.6) {
      strengths.push(`${quantified} of ${expBullets.length} bullets are quantified.`);
    }
    if (!outOfOrder && dated.length === roles.length && roles.length > 0) {
      strengths.push('Roles are dated to the month and listed newest first.');
    }
  }

  // -- Skills --------------------------------------------------------------
  const groups = (resume?.skillGroups ?? []).map((group) => ({
    name: (group.name ?? '').trim(),
    skills: (group.skills ?? []).map((s) => s.trim()).filter(Boolean),
  }));
  const allSkills = groups.flatMap((group) => group.skills);
  const skillSeen = new Map<string, number>();
  for (const skill of allSkills) {
    const key = skill.toLowerCase();
    skillSeen.set(key, (skillSeen.get(key) ?? 0) + 1);
  }
  const duplicates = [...skillSeen.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  const populatedGroups = groups.filter((group) => group.skills.length > 0);

  if (allSkills.length === 0) {
    add({
      id: 'skills.none',
      severity: 'critical',
      area: 'skills',
      message: 'No skills listed.',
      fix: 'Add a Skills section with 8–20 concrete tools and competencies — this is what keyword screens read first.',
      raw: 10,
    });
  } else if (allSkills.length < 6) {
    add({
      id: 'skills.too-few',
      severity: 'warning',
      area: 'skills',
      message: `Only ${allSkills.length} ${plural(allSkills.length, 'skill')} listed.`,
      fix: 'List at least 6 — mix tools (HubSpot, SQL) with competencies (forecasting, coaching).',
      raw: 4,
    });
  }
  if (allSkills.length >= 6 && (populatedGroups.length < 2 || populatedGroups.some((group) => !group.name))) {
    add({
      id: 'skills.ungrouped',
      severity: 'tip',
      area: 'skills',
      message: 'Skills are not grouped under labelled headings.',
      fix: 'Split them into named groups such as "Tools", "Technical" and "Leadership" — easier to skim, still parseable.',
      raw: 2,
    });
  }
  if (duplicates.length > 0) {
    add({
      id: 'skills.duplicates',
      severity: 'tip',
      area: 'skills',
      message: `Duplicate ${plural(duplicates.length, 'skill')}: ${list(duplicates)}.`,
      fix: 'Remove the repeats — duplicated keywords do not improve ranking and waste a line.',
      raw: Math.min(2, duplicates.length),
    });
  }
  if (allSkills.length >= 6 && duplicates.length === 0 && populatedGroups.length >= 2) {
    strengths.push(`${allSkills.length} skills across ${populatedGroups.length} labelled groups.`);
  }

  // -- Education & certifications -----------------------------------------
  const education = (resume?.education ?? []).filter(
    (item) => (item.school ?? '').trim() || (item.degree ?? '').trim() || (item.field ?? '').trim(),
  );
  const certifications = (resume?.certifications ?? []).filter((item) => (item.name ?? '').trim());

  if (education.length === 0 && certifications.length === 0) {
    add({
      id: 'education.missing',
      severity: 'tip',
      area: 'education',
      message: 'No education or certifications.',
      fix: 'Add your highest degree, or a certification / licence — many screens require a value in this field.',
      raw: 3,
    });
  } else if (education.length > 0 && education.every((item) => !(item.degree ?? '').trim())) {
    add({
      id: 'education.no-degree',
      severity: 'tip',
      area: 'education',
      message: 'Education entries have no degree named.',
      fix: 'Spell out the credential ("B.B.A., Marketing") — degree filters look for the exact word.',
      raw: 1,
    });
  } else if (education.length > 0 && certifications.length > 0) {
    strengths.push(`Education plus ${certifications.length} ${plural(certifications.length, 'certification')} listed.`);
  } else if (education.length > 0) {
    strengths.push('Education section is present.');
  } else if (certifications.length > 0) {
    // No education, but certifications carry real weight on their own — say only what is true.
    strengths.push(`${certifications.length} ${plural(certifications.length, 'certification')} listed.`);
  }

  // -- Formatting & length -------------------------------------------------
  const allBullets: BulletInfo[] = [
    ...expBullets,
    ...(resume?.projects ?? []).flatMap((project) => cleanBullets(project).map(describeBullet)),
    ...(resume?.customSections ?? []).flatMap((section) =>
      (section.items ?? []).flatMap((item) => cleanBullets(item).map(describeBullet)),
    ),
  ];

  if (estimatedPagesExact > 2) {
    add({
      id: 'formatting.too-long',
      severity: 'warning',
      area: 'formatting',
      message: `Roughly ${estimatedPages} pages (${totalWords} words).`,
      fix: 'Trim to two pages: drop roles older than 10–15 years and keep 2–3 bullets on early jobs.',
      raw: 4,
    });
  } else if (totalWords < 120) {
    add({
      id: 'formatting.too-short',
      severity: 'warning',
      area: 'formatting',
      message: `Only ${totalWords} ${plural(totalWords, 'word')} of content — under a quarter page.`,
      fix: 'Fill out the summary, 3–6 bullets per role and a skills list; aim for at least one full page.',
      raw: 8,
    });
  } else if (totalWords < 250) {
    add({
      id: 'formatting.thin',
      severity: 'tip',
      area: 'formatting',
      message: `About ${estimatedPages} ${plural(Math.round(estimatedPages), 'page')} of content (${totalWords} words).`,
      fix: 'A one-page resume reads best at roughly 450–550 words — add achievements to your most recent role.',
      raw: 4,
    });
  }

  const buzzwords = findBuzzwords(plainText);
  if (buzzwords.length > 0) {
    add({
      id: 'formatting.buzzwords',
      severity: 'tip',
      area: 'formatting',
      message: `Filler ${plural(buzzwords.length, 'phrase')} found: ${list(buzzwords)}.`,
      fix: 'Swap claims for proof — "team player" becomes "coached 14 reps to a 16-point show-rate lift".',
      raw: Math.min(3, buzzwords.length),
    });
  }

  const verbCounts = new Map<string, number>();
  for (const bullet of allBullets) {
    if (!bullet.verbRoot) continue;
    verbCounts.set(bullet.verbRoot, (verbCounts.get(bullet.verbRoot) ?? 0) + 1);
  }
  const repeated = [...verbCounts.entries()].filter(([, count]) => count >= 3).map(([verb, count]) => `${verb} ×${count}`);
  if (repeated.length > 0 && allBullets.length >= 5) {
    add({
      id: 'formatting.repeated-verbs',
      severity: 'tip',
      area: 'formatting',
      message: `The same opening verb repeats: ${list(repeated)}.`,
      fix: 'Vary the openers — Led, Scaled, Rebuilt, Negotiated, Automated — so bullets do not blur together.',
      raw: Math.min(2, repeated.length),
    });
  }

  const pronounBullets = allBullets.filter((bullet) => bullet.pronouns.length > 0);
  if (pronounBullets.length > 0) {
    add({
      id: 'formatting.pronouns',
      severity: 'warning',
      area: 'formatting',
      message: `${pronounBullets.length} ${plural(pronounBullets.length, 'bullet uses', 'bullets use')} first-person pronouns.`,
      fix: 'Resume bullets are implied first person — delete "I", "my" and "we" and start with the verb.',
      raw: 3,
    });
  }

  const capsBullets = allBullets.filter((bullet) => bullet.allCaps);
  if (capsBullets.length > 0) {
    add({
      id: 'formatting.all-caps',
      severity: 'warning',
      area: 'formatting',
      message: `${capsBullets.length} ${plural(capsBullets.length, 'bullet is', 'bullets are')} in ALL CAPS.`,
      fix: 'Use sentence case. All-caps text reads as shouting and some parsers mangle it.',
      raw: 2,
    });
  }

  if (estimatedPagesExact <= 2 && totalWords >= 250 && buzzwords.length === 0 && pronounBullets.length === 0) {
    strengths.push(
      estimatedPagesExact < 1
        ? `Clean single-column layout that fits on one page (${totalWords} words).`
        : `Clean single-column layout, about ${estimatedPages} ${plural(Math.round(estimatedPages), 'page')}.`,
    );
  }

  // -- Keywords vs job -----------------------------------------------------
  const jd = (jobText ?? '').trim();
  const withJob = jd.length > 0;
  let keywordCoverage: AtsReport['keywordCoverage'];

  if (withJob) {
    const { required, niceToHave } = extractRequirements(jd);
    // The dictionary returns canonical names, so compare canonical-to-canonical: a resume
    // that says "hub spot" still matches a posting that says "HubSpot".
    const resumeSkills = new Set(extractSkills(plainText).map((skill) => skill.toLowerCase()));
    const has = (skill: string): boolean => resumeSkills.has(skill.toLowerCase());

    const matched = required.filter(has);
    const missing = required.filter((skill) => !has(skill));
    const percent = required.length > 0 ? Math.round((matched.length / required.length) * 100) : 100;
    keywordCoverage = { matched, missing, percent };

    if (required.length === 0) {
      add({
        id: 'keywords.none-detected',
        severity: 'tip',
        area: 'keywords',
        message: 'No concrete skill requirements detected in that job description.',
        fix: 'Paste the full posting including the "Requirements" or "What you bring" section for a keyword check.',
        raw: 1,
      });
    } else {
      const ratio = matched.length / required.length;
      if (missing.length > 0) {
        add({
          id: 'keywords.coverage',
          severity: ratio < 0.4 ? 'critical' : ratio < 0.7 ? 'warning' : 'tip',
          area: 'keywords',
          message: `Your resume covers ${matched.length} of ${required.length} required skills (${percent}%).`,
          fix: 'Mirror the posting’s wording for the skills you genuinely have — in your summary, bullets and skills list.',
          raw: Math.round((1 - ratio) * 9),
        });
        add({
          id: 'keywords.missing-top',
          severity: ratio < 0.6 ? 'critical' : 'tip',
          area: 'keywords',
          message: `Missing high-priority keywords: ${list(missing, 3)}.`,
          fix: `Add ${list(missing, 3)} to your skills or a bullet that proves it — only if it is true.`,
          raw: ratio < 0.6 ? 5 : 1,
        });
      } else {
        strengths.push(`Covers all ${required.length} required skills in the job description.`);
      }

      const missingNice = niceToHave.filter((skill) => !has(skill));
      if (missingNice.length >= 3) {
        add({
          id: 'keywords.nice-to-have',
          severity: 'tip',
          area: 'keywords',
          message: `Nice-to-haves you do not mention: ${list(missingNice)}.`,
          fix: 'Pick the one or two you actually have and work them into a bullet — they break ties.',
          raw: 1,
        });
      }
      if (ratio >= 0.8 && missing.length > 0) {
        strengths.push(`Strong keyword coverage: ${percent}% of required skills.`);
      }
    }
  }

  // -- Scale, score, assemble ---------------------------------------------
  const activeCategories = CATEGORY_DEFS.filter((category) => category.id !== 'keywords' || withJob);
  const activeWeight = activeCategories.reduce((sum, category) => sum + category.weight, 0);
  const factor = 100 / activeWeight;

  const finalIssues: AtsIssue[] = issues.map((issue) => ({
    id: issue.id,
    severity: issue.severity,
    area: issue.area,
    message: issue.message,
    fix: issue.fix,
    impact: Math.max(1, Math.round(issue.raw * factor)),
  }));

  const severityRank: Record<AtsSeverity, number> = { critical: 0, warning: 1, tip: 2 };
  finalIssues.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || b.impact - a.impact || a.id.localeCompare(b.id),
  );

  const totalImpact = finalIssues.reduce((sum, issue) => sum + issue.impact, 0);
  const score = clamp(Math.round(100 - totalImpact), 0, 100);

  const categories: AtsCategoryScore[] = activeCategories.map((category) => {
    const weight = Math.round(category.weight * factor * 10) / 10;
    const impact = finalIssues
      .filter((issue) => issue.area === category.id)
      .reduce((sum, issue) => sum + issue.impact, 0);
    const categoryScore = weight > 0 ? clamp(Math.round(100 - (impact / weight) * 100), 0, 100) : 100;
    return { id: category.id, label: category.label, score: categoryScore, weight };
  });

  return {
    score,
    categories,
    issues: finalIssues,
    strengths,
    ...(keywordCoverage ? { keywordCoverage } : {}),
    stats: {
      wordCount: totalWords,
      bulletCount: allBullets.length,
      quantifiedBullets: allBullets.filter((bullet) => bullet.quantified).length,
      actionVerbBullets: allBullets.filter((bullet) => bullet.verbRoot !== null && !bullet.weak).length,
      estimatedPages,
    },
  };
}

/** Convenience for badges: the tone that matches an overall ATS score. */
export function atsScoreTone(score: number): 'success' | 'info' | 'warning' | 'danger' {
  if (score >= 85) return 'success';
  if (score >= 70) return 'info';
  if (score >= 50) return 'warning';
  return 'danger';
}

/** Short human label for an overall ATS score. */
export function atsScoreLabel(score: number): string {
  if (score >= 90) return 'ATS ready';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Needs work';
  if (score >= 40) return 'Weak';
  return 'Incomplete';
}
