import { describe, expect, it } from 'vitest';
import type { Resume } from '@shared/types';
import { analyzeResume, atsScoreLabel, atsScoreTone } from '@/lib/resume/ats';
import {
  createBlankResume,
  createExperienceItem,
  createSampleResume,
  createSkillGroup,
} from '@/lib/resume/defaults';

function withExperience(bullets: string[], partial: Parameters<typeof createExperienceItem>[0] = {}): Resume {
  const resume = createSampleResume();
  return {
    ...resume,
    projects: [],
    customSections: [],
    experience: [
      createExperienceItem({
        company: 'Acme Co',
        title: 'Operations Manager',
        startDate: '2020-01',
        endDate: '',
        current: true,
        bullets,
        ...partial,
      }),
    ],
  };
}

describe('analyzeResume — overall scoring', () => {
  it('scores the sample resume at least 80 with no critical issues', () => {
    const report = analyzeResume(createSampleResume());
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.issues.filter((issue) => issue.severity === 'critical')).toEqual([]);
    expect(report.strengths.length).toBeGreaterThan(3);
  });

  it('scores a blank resume under 30 and flags missing contact details as critical', () => {
    const report = analyzeResume(createBlankResume());
    expect(report.score).toBeLessThan(30);
    const criticalIds = report.issues.filter((i) => i.severity === 'critical').map((i) => i.id);
    expect(criticalIds).toContain('contact.name-missing');
    expect(criticalIds).toContain('contact.email-missing');
    expect(criticalIds).toContain('experience.none');
  });

  it('is deterministic', () => {
    const resume = createSampleResume();
    expect(analyzeResume(resume)).toEqual(analyzeResume(resume));
  });

  it('keeps the score equal to 100 minus the sum of every issue impact', () => {
    const resume = createBlankResume();
    const report = analyzeResume(resume);
    const total = report.issues.reduce((sum, issue) => sum + issue.impact, 0);
    expect(report.score).toBe(Math.max(0, 100 - total));
  });

  it('orders issues critical → warning → tip', () => {
    const report = analyzeResume(createBlankResume());
    const rank = { critical: 0, warning: 1, tip: 2 } as const;
    const ranks = report.issues.map((issue) => rank[issue.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('gives every issue a concrete fix', () => {
    const report = analyzeResume(createBlankResume());
    expect(report.issues.length).toBeGreaterThan(0);
    for (const issue of report.issues) {
      expect(issue.fix.length).toBeGreaterThan(12);
      expect(issue.impact).toBeGreaterThan(0);
      expect(issue.message.length).toBeGreaterThan(5);
    }
  });

  it('exposes score helpers', () => {
    expect(atsScoreTone(92)).toBe('success');
    expect(atsScoreTone(20)).toBe('danger');
    expect(atsScoreLabel(95)).toBe('ATS ready');
    expect(atsScoreLabel(10)).toBe('Incomplete');
  });
});

describe('analyzeResume — categories and weights', () => {
  it('uses the spec weights when a job description is supplied', () => {
    const report = analyzeResume(createSampleResume(), 'We need HubSpot and SQL experience.');
    const weights = Object.fromEntries(report.categories.map((c) => [c.id, c.weight]));
    expect(weights).toEqual({
      contact: 15,
      summary: 10,
      experience: 30,
      skills: 15,
      education: 5,
      formatting: 10,
      keywords: 15,
    });
    expect(report.categories.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
  });

  it('redistributes the keywords weight proportionally when no job description is given', () => {
    const report = analyzeResume(createSampleResume());
    expect(report.categories.map((c) => c.id)).not.toContain('keywords');
    const total = report.categories.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBeCloseTo(100, 5);
    const experience = report.categories.find((c) => c.id === 'experience');
    expect(experience?.weight).toBeCloseTo((30 / 85) * 100, 1);
  });

  it('drops a category score in proportion to its own issues', () => {
    const resume = createSampleResume();
    resume.contact = { ...resume.contact, phone: '', location: '' };
    const report = analyzeResume(resume);
    const contact = report.categories.find((c) => c.id === 'contact');
    expect(contact).toBeDefined();
    expect(contact!.score).toBeLessThan(100);
    expect(report.categories.find((c) => c.id === 'experience')?.score).toBe(100);
  });
});

describe('analyzeResume — contact checks', () => {
  it('flags a malformed email', () => {
    const resume = createSampleResume();
    resume.contact = { ...resume.contact, email: 'jordan.rivera at example' };
    const report = analyzeResume(resume);
    const issue = report.issues.find((i) => i.id === 'contact.email-format');
    expect(issue?.severity).toBe('critical');
  });

  it('tips when the headline is missing', () => {
    const resume = createSampleResume();
    resume.contact = { ...resume.contact, headline: '' };
    const report = analyzeResume(resume);
    expect(report.issues.map((i) => i.id)).toContain('contact.headline-missing');
  });
});

describe('analyzeResume — summary checks', () => {
  it('flags first-person writing', () => {
    const resume = createSampleResume();
    resume.summary =
      'I am a marketing operations leader with eight years of experience. My teams book more tours than any other region and we cut cost per tour by a third last year alone.';
    const report = analyzeResume(resume);
    expect(report.issues.map((i) => i.id)).toContain('summary.first-person');
  });

  it('flags a summary that is too short and one that is too long', () => {
    const short = createSampleResume();
    short.summary = 'Marketing ops leader.';
    expect(analyzeResume(short).issues.map((i) => i.id)).toContain('summary.too-short');

    const long = createSampleResume();
    long.summary = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
    expect(analyzeResume(long).issues.map((i) => i.id)).toContain('summary.too-long');
  });
});

describe('analyzeResume — experience quality', () => {
  it('detects weak, duty-style bullet openers', () => {
    const resume = withExperience([
      'Responsible for the daily operation of a 14-rep call center serving 900 tours per month.',
      'Helped with the rollout of a new dialer platform across three call centers in 2023.',
      'Built HubSpot automations that recovered 22% of missed calls, adding 190 tours a quarter.',
    ]);
    const report = analyzeResume(resume);
    const issue = report.issues.find((i) => i.id === 'experience.weak-verbs');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('responsible for');
    expect(report.stats.actionVerbBullets).toBe(1);
  });

  it('counts quantified bullets and flags a resume without numbers', () => {
    const resume = withExperience([
      'Led the call center team through a platform migration without service interruption.',
      'Coached representatives on discovery questions and objection handling every week.',
      'Rebuilt the reporting pack that leadership reviews during the weekly pipeline meeting.',
    ]);
    const report = analyzeResume(resume);
    expect(report.stats.quantifiedBullets).toBe(0);
    const issue = report.issues.find((i) => i.id === 'experience.not-quantified');
    expect(issue?.severity).toBe('critical');
  });

  it('counts quantified bullets correctly when numbers, percentages and currency are used', () => {
    const resume = withExperience([
      'Led a 14-rep call center that booked 900 resort tours every month across four states.',
      'Reduced cost per tour by 31% while holding the marketing budget flat year over year.',
      'Recovered $412,000 of pipeline by rebuilding the missed-call callback workflow in Twilio.',
      'Coached representatives on discovery questions and objection handling every single week.',
    ]);
    const report = analyzeResume(resume);
    expect(report.stats.bulletCount).toBe(4);
    expect(report.stats.quantifiedBullets).toBe(3);
    expect(report.issues.map((i) => i.id)).not.toContain('experience.not-quantified');
  });

  it('warns when a role has fewer than two bullets', () => {
    const resume = withExperience(['Led a 14-rep call center that booked 900 resort tours every single month.']);
    expect(analyzeResume(resume).issues.map((i) => i.id)).toContain('experience.too-few-bullets');
  });

  it('tips when a role has more than seven bullets', () => {
    const bullets = Array.from(
      { length: 9 },
      (_, i) => `Launched initiative ${i + 1} that lifted booked tours by ${i + 3}% across the region.`,
    );
    expect(analyzeResume(withExperience(bullets)).issues.map((i) => i.id)).toContain('experience.too-many-bullets');
  });

  it('flags bullets outside the 8–30 word range', () => {
    const resume = withExperience([
      'Led the team.',
      'Reduced cost per tour by 31% while holding the marketing budget flat year over year.',
      `Rebuilt ${Array.from({ length: 40 }, (_, i) => `item${i}`).join(' ')} with 12% gains.`,
    ]);
    const issue = analyzeResume(resume).issues.find((i) => i.id === 'experience.bullet-length');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('1 too long');
  });

  it('flags missing or malformed dates', () => {
    const resume = withExperience(
      ['Led a 14-rep call center that booked 900 resort tours every single month of the year.'],
      { startDate: '2021', endDate: 'yesterday', current: false },
    );
    expect(analyzeResume(resume).issues.map((i) => i.id)).toContain('experience.dates');
  });

  it('flags roles listed out of reverse-chronological order', () => {
    const resume = createSampleResume();
    resume.experience = [...resume.experience].reverse();
    expect(analyzeResume(resume).issues.map((i) => i.id)).toContain('experience.order');
  });

  it('tips on employment gaps longer than twelve months', () => {
    const resume = createSampleResume();
    resume.experience = [
      createExperienceItem({
        company: 'Acme Co',
        title: 'Operations Manager',
        startDate: '2023-01',
        current: true,
        bullets: ['Led a 14-rep call center that booked 900 resort tours every month across four states.'],
      }),
      createExperienceItem({
        company: 'Older Co',
        title: 'Analyst',
        startDate: '2017-01',
        endDate: '2019-06',
        current: false,
        bullets: ['Reduced cost per tour by 31% while holding the marketing budget flat year over year.'],
      }),
    ];
    const issue = analyzeResume(resume).issues.find((i) => i.id === 'experience.gaps');
    expect(issue?.severity).toBe('tip');
  });

  it('raises a critical issue when the current role has no bullets', () => {
    const resume = createSampleResume();
    resume.experience = [
      createExperienceItem({ company: 'Acme Co', title: 'Operations Manager', startDate: '2021-01', current: true, bullets: [] }),
      ...resume.experience.slice(1),
    ];
    const issue = analyzeResume(resume).issues.find((i) => i.id === 'experience.current-empty');
    expect(issue?.severity).toBe('critical');
  });
});

describe('analyzeResume — skills, education and formatting', () => {
  it('flags fewer than six skills and duplicates', () => {
    const resume = createSampleResume();
    resume.skillGroups = [createSkillGroup({ name: 'Tools', skills: ['HubSpot', 'hubspot', 'SQL'] })];
    const ids = analyzeResume(resume).issues.map((i) => i.id);
    expect(ids).toContain('skills.too-few');
    expect(ids).toContain('skills.duplicates');
  });

  it('tips when skills are not grouped', () => {
    const resume = createSampleResume();
    resume.skillGroups = [
      createSkillGroup({ name: '', skills: ['HubSpot', 'Salesforce', 'SQL', 'Twilio', 'Excel', 'Python', 'Looker'] }),
    ];
    expect(analyzeResume(resume).issues.map((i) => i.id)).toContain('skills.ungrouped');
  });

  it('tips when neither education nor certifications are present', () => {
    const resume = createSampleResume();
    resume.education = [];
    resume.certifications = [];
    const issue = analyzeResume(resume).issues.find((i) => i.id === 'education.missing');
    expect(issue?.severity).toBe('tip');
  });

  it('estimates page count and warns beyond two pages', () => {
    const resume = createSampleResume();
    const filler = Array.from({ length: 60 }, (_, i) => `Automated workflow ${i} saving 12 hours each week for the team.`);
    resume.experience = [
      createExperienceItem({ company: 'Acme', title: 'Manager', startDate: '2020-01', current: true, bullets: filler }),
    ];
    resume.summary = Array.from({ length: 60 }, (_, i) => `phrase${i}`).join(' ');
    resume.projects = resume.projects.map((p) => ({ ...p, bullets: filler }));
    const report = analyzeResume(resume);
    expect(report.stats.estimatedPages).toBeGreaterThan(2);
    expect(report.issues.map((i) => i.id)).toContain('formatting.too-long');
  });

  it('flags buzzwords, repeated openers, pronouns and ALL-CAPS bullets', () => {
    const resume = withExperience([
      'Led a team player culture of 14 reps booking 900 tours per month across four states.',
      'Led my own dialer migration that cut dropped calls 22% in the first quarter of 2024.',
      'Led the rebuild of the reporting pack leadership reviews each Monday, saving 6 hours.',
      'REDUCED COST PER TOUR BY 31% WHILE HOLDING THE MARKETING BUDGET FLAT YEAR OVER YEAR.',
      'Negotiated a carrier contract that saved $84,000 in annual telephony spend for the group.',
    ]);
    const ids = analyzeResume(resume).issues.map((i) => i.id);
    expect(ids).toContain('formatting.buzzwords');
    expect(ids).toContain('formatting.repeated-verbs');
    expect(ids).toContain('formatting.pronouns');
    expect(ids).toContain('formatting.all-caps');
  });
});

describe('analyzeResume — resilience', () => {
  it('survives a resume with missing collections', () => {
    const broken = { ...createBlankResume() } as unknown as Record<string, unknown>;
    delete broken.experience;
    delete broken.skillGroups;
    delete broken.education;
    delete broken.projects;
    delete broken.customSections;
    delete broken.certifications;
    const report = analyzeResume(broken as unknown as Resume);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.stats.bulletCount).toBe(0);
  });
});
