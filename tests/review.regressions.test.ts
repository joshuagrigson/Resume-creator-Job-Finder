/**
 * One test per defect confirmed by the adversarial review pass.
 *
 * These are the cases that shipped broken, so each one names the finding it pins down.
 * If any of these fail again, the bug is back.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeHtml, stripHtml } from '../server/jobs/sanitize';
import { parseSalaryText } from '../server/jobs/normalize';
import { resumeSkillSet, withSkillsAdded } from '../src/components/tailor/helpers';
import { normalizeImportedResume, normalizeImportedResumeBundle } from '../src/lib/resume/validate';
import { toYearMonth } from '../src/lib/resume/parse-text';
import { analyzeResume } from '../src/lib/resume/ats';
import { createBlankResume, createSampleResume, createSkillGroup } from '../src/lib/resume/defaults';
import { extractRequirements } from '../shared/keywords';

describe('server HTML sanitizer: attribute separators', () => {
  // Whitespace-anchored patterns walked straight past these two.
  it('drops a handler separated by a slash', () => {
    expect(sanitizeHtml('<a/onclick=alert(1)>x</a>')).not.toMatch(/onclick/i);
  });

  it('drops a handler butted against a closing quote', () => {
    const out = sanitizeHtml('<a href="y"onclick=alert(1)>x</a>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain('href="y"');
  });

  it('drops uppercase handlers and srcdoc', () => {
    expect(sanitizeHtml('<img ONLOAD=alert(1) src=x>')).not.toMatch(/onload/i);
    expect(sanitizeHtml('<div srcdoc="<b>x</b>">y</div>')).not.toMatch(/srcdoc/i);
  });

  it('neutralizes javascript: URLs, including entity-obfuscated ones', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toContain('href="#"');
    expect(sanitizeHtml('<a href="java&#0000009;script:alert(1)">x</a>')).toContain('href="#"');
  });

  it('drops inline style, which can cover the viewport or beacon out', () => {
    expect(sanitizeHtml('<div style="position:fixed;inset:0">x</div>')).not.toMatch(/style=/i);
  });

  it('leaves ordinary posting markup intact', () => {
    const out = sanitizeHtml('<p>Own <b>HubSpot</b> and <a href="https://x.co/j" target="_blank">apply</a>.</p>');
    expect(out).toContain('<b>HubSpot</b>');
    expect(out).toContain('href="https://x.co/j"');
    expect(out).toContain('target="_blank"');
    expect(stripHtml(out)).toContain('Own HubSpot and apply.');
  });
});

describe('salary parsing: one pay expression, not every digit', () => {
  it('ignores 401k and bonus percentages', () => {
    expect(parseSalaryText('$120k base, 401k match, 15% bonus')).toMatchObject({ currency: 'USD', min: 120_000 });
    expect(parseSalaryText('$120k base, 401k match, 15% bonus').max).toBeUndefined();
  });

  it('reads an explicit range', () => {
    expect(parseSalaryText('$120,000 - $150,000 per year')).toMatchObject({
      currency: 'USD',
      period: 'year',
      min: 120_000,
      max: 150_000,
    });
  });

  it('reads European decimal separators', () => {
    expect(parseSalaryText('€60.000 – €80.000 per year')).toMatchObject({ currency: 'EUR', min: 60_000, max: 80_000 });
  });

  it('finds no amounts in a benefits sentence', () => {
    const parsed = parseSalaryText('Competitive salary, 25 days holiday, 3x life insurance');
    expect(parsed.min).toBeUndefined();
    expect(parsed.max).toBeUndefined();
    expect(parsed.currency).toBeUndefined();
  });

  it('labels C$ as CAD and A$ as AUD rather than USD', () => {
    expect(parseSalaryText('C$95,000 to C$120,000')).toMatchObject({ currency: 'CAD', min: 95_000, max: 120_000 });
    expect(parseSalaryText('A$140k')).toMatchObject({ currency: 'AUD', min: 140_000 });
  });
});

describe('tailor keyword gap: canonical on both sides', () => {
  const resume = {
    ...createBlankResume('Alias spellings'),
    skillGroups: [createSkillGroup({ name: 'Tools', skills: ['JS', 'React.js', 'Node', 'Postgres'] })],
  };

  it('recognises a canonical requirement the resume spells as an alias', () => {
    const have = resumeSkillSet(resume);
    const required = extractRequirements(
      'Requirements: strong JavaScript and React experience, Node.js backend work, PostgreSQL databases.',
    ).required;
    expect(required.length).toBeGreaterThan(0);
    for (const skill of required) {
      expect(have.has(skill.toLowerCase()), `${skill} should already count as present`).toBe(true);
    }
  });

  it('does not append a duplicate of a skill already present under another spelling', () => {
    const after = withSkillsAdded(resume, ['JavaScript', 'PostgreSQL']);
    expect(after).toBe(resume);
  });

  it('still adds a genuinely new skill', () => {
    const after = withSkillsAdded(resume, ['Kubernetes']);
    expect(after.skillGroups[0].skills).toContain('Kubernetes');
  });
});

describe('backup restore keeps every resume', () => {
  const bundle = {
    app: 'launchpad',
    schemaVersion: 1,
    exportedAt: '2026-09-13T00:00:00.000Z',
    resumes: [
      { ...createSampleResume(), name: 'First' },
      { ...createSampleResume(), name: 'Second' },
      { ...createSampleResume(), name: 'Third' },
    ],
  };

  it('restores all three, not just the first', () => {
    const result = normalizeImportedResumeBundle(JSON.stringify(bundle));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.resumes.map((r) => r.name)).toEqual(['First', 'Second', 'Third']);
    // Fresh ids, so a restore never overwrites what is already in the store.
    expect(new Set(result.resumes.map((r) => r.id)).size).toBe(3);
  });

  it('accepts a bare array too', () => {
    const result = normalizeImportedResumeBundle(JSON.stringify(bundle.resumes));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.resumes).toHaveLength(3);
  });

  it('leaves the single-resume contract alone for the editor import dialog', () => {
    const single = normalizeImportedResume(JSON.stringify(bundle));
    expect('error' in single).toBe(false);
    if ('error' in single) return;
    expect(single.resume.name).toBe('First');
    expect(single.warnings.join(' ')).toMatch(/3 resumes/);
  });
});

describe('free-text certification dates are not rewritten', () => {
  it('keeps a phrase that only mentions a year', () => {
    const imported = normalizeImportedResume({
      contact: { fullName: 'Dana Reed' },
      certifications: [
        { name: 'CDL Class A', issuer: 'TX DPS', date: 'Valid through 2027' },
        { name: 'OSHA 30', issuer: 'OSHA', date: 'March 2021' },
      ],
    });
    expect('error' in imported).toBe(false);
    if ('error' in imported) return;
    const dates = imported.resume.certifications.map((c) => c.date);
    expect(dates[0]).toBe('Valid through 2027');
    expect(dates[1]).toBe('2021-03');
  });

  it('strict mode declines to invent a month', () => {
    expect(toYearMonth('Valid through 2027', 'end')).toBe('2027-12');
    expect(toYearMonth('Valid through 2027', 'end', { strict: true })).toBe('');
    expect(toYearMonth('March 2021', 'end', { strict: true })).toBe('2021-03');
  });
});

describe('ATS strengths tell the truth about education', () => {
  it('does not claim education for a resume that has none', () => {
    const resume = {
      ...createSampleResume(),
      education: [],
    };
    const report = analyzeResume(resume);
    const claimsEducation = report.strengths.some((s) => /education/i.test(s));
    expect(claimsEducation).toBe(false);
    // The certifications it does have are still credited.
    expect(report.strengths.some((s) => /certification/i.test(s))).toBe(true);
  });

  it('still credits both when both are present', () => {
    const report = analyzeResume(createSampleResume());
    expect(report.strengths.some((s) => /Education plus \d+ certification/i.test(s))).toBe(true);
  });
});
