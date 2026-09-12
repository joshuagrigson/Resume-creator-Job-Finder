import { describe, expect, it } from 'vitest';
import { analyzeResume } from '@/lib/resume/ats';
import { createBlankResume, createSampleResume, createSkillGroup } from '@/lib/resume/defaults';
import {
  ACTION_VERBS,
  actionVerbRoot,
  findBuzzwords,
  firstPersonPronouns,
  isActionVerb,
  weakStartMatch,
} from '@/lib/resume/action-verbs';

const MARKETING_OPS_JD = `
Senior Marketing Operations Manager — Austin, TX

Requirements:
- 5+ years of hands-on experience with HubSpot and Salesforce
- Strong SQL skills and experience building dashboards in Tableau
- Experience with Twilio, Marketo and lead scoring models
- Must have Python scripting experience

Nice to have:
- Looker, Snowflake and dbt
`;

describe('analyzeResume — keyword coverage', () => {
  it('reports matched and missing required skills with a coverage percentage', () => {
    const report = analyzeResume(createSampleResume(), MARKETING_OPS_JD);
    const coverage = report.keywordCoverage;
    expect(coverage).toBeDefined();
    expect(coverage!.matched).toContain('HubSpot');
    expect(coverage!.matched).toContain('Salesforce');
    expect(coverage!.matched).toContain('Twilio');
    expect(coverage!.matched).toContain('SQL');
    expect(coverage!.missing).toContain('Tableau');
    expect(coverage!.percent).toBe(
      Math.round((coverage!.matched.length / (coverage!.matched.length + coverage!.missing.length)) * 100),
    );
    expect(coverage!.percent).toBeGreaterThan(70);
  });

  it('omits keywordCoverage when no job description is given', () => {
    expect(analyzeResume(createSampleResume()).keywordCoverage).toBeUndefined();
    expect(analyzeResume(createSampleResume(), '   ').keywordCoverage).toBeUndefined();
  });

  it('raises a critical issue naming the top missing keywords when coverage is poor', () => {
    const resume = createSampleResume();
    resume.summary = 'Operations leader focused on scheduling, staffing and vendor management for field teams.';
    resume.skillGroups = [createSkillGroup({ name: 'Ops', skills: ['Scheduling', 'Vendor management'] })];
    resume.experience = resume.experience.map((role) => ({
      ...role,
      bullets: ['Coordinated field crews and vendor schedules across four regions every single week.'],
    }));
    resume.projects = [];
    resume.certifications = [];

    const report = analyzeResume(resume, MARKETING_OPS_JD);
    const coverage = report.keywordCoverage!;
    expect(coverage.percent).toBeLessThan(60);

    const missingIssue = report.issues.find((i) => i.id === 'keywords.missing-top');
    expect(missingIssue?.severity).toBe('critical');
    for (const skill of coverage.missing.slice(0, 3)) {
      expect(missingIssue!.message).toContain(skill);
    }
    const coverageIssue = report.issues.find((i) => i.id === 'keywords.coverage');
    expect(coverageIssue).toBeDefined();
    expect(coverageIssue!.impact).toBeGreaterThan(0);
  });

  it('tips about nice-to-haves the resume does not mention', () => {
    const report = analyzeResume(createSampleResume(), MARKETING_OPS_JD);
    const issue = report.issues.find((i) => i.id === 'keywords.nice-to-have');
    expect(issue?.severity).toBe('tip');
    expect(issue!.message).toContain('Looker');
  });

  it('explains when the pasted text contains no detectable requirements', () => {
    const report = analyzeResume(createSampleResume(), 'We are hiring. Come join a friendly place to work.');
    expect(report.keywordCoverage).toEqual({ matched: [], missing: [], percent: 100 });
    expect(report.issues.map((i) => i.id)).toContain('keywords.none-detected');
  });

  it('keeps the blank resume low even with a job description', () => {
    const report = analyzeResume(createBlankResume(), MARKETING_OPS_JD);
    expect(report.score).toBeLessThan(30);
    expect(report.categories.map((c) => c.id)).toContain('keywords');
  });
});

describe('action verb vocabulary', () => {
  it('ships roughly 300 unique base verbs', () => {
    expect(ACTION_VERBS.length).toBeGreaterThanOrEqual(280);
    expect(new Set(ACTION_VERBS).size).toBe(ACTION_VERBS.length);
    expect(ACTION_VERBS.every((verb) => verb === verb.toLowerCase())).toBe(true);
  });

  it('resolves regular and irregular inflections to a base verb', () => {
    expect(actionVerbRoot('Managed')).toBe('manage');
    expect(actionVerbRoot('Migrated')).toBe('migrate');
    expect(actionVerbRoot('Shipped')).toBe('ship');
    expect(actionVerbRoot('Identified')).toBe('identify');
    expect(actionVerbRoot('Building')).toBe('build');
    expect(actionVerbRoot('Leads')).toBe('lead');
    expect(actionVerbRoot('Led')).toBe('lead');
    expect(actionVerbRoot('Built')).toBe('build');
    expect(actionVerbRoot('Oversaw')).toBe('oversee');
    expect(actionVerbRoot('Wrote')).toBe('write');
    expect(actionVerbRoot('banana')).toBeNull();
    expect(actionVerbRoot('')).toBeNull();
  });

  it('recognizes verbs regardless of surrounding punctuation', () => {
    expect(isActionVerb('“Delivered')).toBe(true);
    expect(isActionVerb('Automated,')).toBe(true);
  });

  it('detects weak openers, longest phrase first', () => {
    expect(weakStartMatch('Was responsible for the dialer rollout')?.phrase).toBe('was responsible for');
    expect(weakStartMatch('Responsible for the dialer rollout')?.phrase).toBe('responsible for');
    expect(weakStartMatch('• Helped with onboarding')?.phrase).toBe('helped with');
    expect(weakStartMatch('Led the dialer rollout')).toBeNull();
    expect(weakStartMatch('')).toBeNull();
  });

  it('detects buzzwords and first-person pronouns', () => {
    expect(findBuzzwords('A detail-oriented team player with synergy.')).toEqual(
      expect.arrayContaining(['synergy', 'team player', 'detail-oriented']),
    );
    expect(findBuzzwords('Led a disciplined operations team.')).toEqual([]);
    expect(firstPersonPronouns('I led my team')).toEqual(['I', 'my']);
    expect(firstPersonPronouns('Worked in the US market')).toEqual([]);
  });
});
