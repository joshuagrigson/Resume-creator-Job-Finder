import { describe, expect, it } from 'vitest';
import type { Job } from '@shared/types';
import { type MatchableJob, type ResumeProfile, matchLabel, scoreJobMatch, titleSimilarity } from '@shared/match';
import { createExperienceItem, createSampleResume, createSkillGroup } from '@/lib/resume/defaults';
import { experienceMonths, resumeProfile, resumeToPlainText, yearsOfExperience } from '@/lib/resume/profile';

function job(partial: Partial<MatchableJob>): MatchableJob {
  return { title: '', descriptionText: '', tags: [], category: undefined, ...partial };
}

const MARKETING_OPS_JOB = job({
  title: 'Marketing Operations Manager',
  category: 'Marketing',
  tags: ['hubspot', 'marketing automation', 'salesforce'],
  descriptionText: `We are looking for a Marketing Operations Manager to own our demand generation stack.

Requirements:
- 5+ years in marketing operations with HubSpot and Salesforce
- Hands-on experience building lead scoring models and campaign management workflows
- Strong reporting skills in GA4 and Excel
- Experience with A/B testing and email marketing

Nice to have:
- Twilio or another SMS platform
- SQL for ad-hoc analysis`,
});

const NURSE_JOB = job({
  title: 'Registered Nurse — Med Surg',
  category: 'Healthcare',
  tags: ['nursing', 'hospital'],
  descriptionText: `Requirements:
- Active RN license and BLS certification
- 2+ years of acute care nursing experience
- Charting in Epic EMR, medication administration and wound care
- Strong patient assessment and triage skills

Nice to have:
- ACLS certification
- Telehealth experience`,
});

const marketingProfile = resumeProfile(createSampleResume(), new Date('2025-06-15T00:00:00Z'));

describe('resumeToPlainText', () => {
  it('renders the whole resume in reading order', () => {
    const text = resumeToPlainText(createSampleResume());
    expect(text.startsWith('Jordan Rivera\nMarketing Operations Manager')).toBe(true);
    const order = ['Summary', 'Experience', 'Skills', 'Education', 'Projects', 'Certifications'];
    let cursor = -1;
    for (const heading of order) {
      const index = text.indexOf(`\n${heading}\n`);
      expect(index, `missing section ${heading}`).toBeGreaterThan(cursor);
      cursor = index;
    }
    expect(text).toContain('Built HubSpot + Twilio automations');
    expect(text).toContain('B.B.A., Marketing');
  });

  it('skips hidden sections and honours a custom section order', () => {
    const resume = createSampleResume();
    resume.style.sectionOrder = ['skills', 'summary', 'experience', 'education', 'projects', 'certifications'];
    resume.style.hiddenSections = ['projects'];
    const text = resumeToPlainText(resume);
    expect(text.indexOf('\nSkills\n')).toBeLessThan(text.indexOf('\nSummary\n'));
    expect(text).not.toContain('Agent Coaching Platform');
  });

  it('survives an empty resume', () => {
    const resume = createSampleResume();
    const blank = {
      ...resume,
      contact: { fullName: '', headline: '', email: '', phone: '', location: '', website: '', linkedin: '', github: '' },
      summary: '',
      experience: [],
      education: [],
      skillGroups: [],
      projects: [],
      certifications: [],
      customSections: [],
    };
    expect(resumeToPlainText(blank)).toBe('');
  });
});

describe('resumeProfile', () => {
  it('unions skill groups with skills found in the resume body', () => {
    expect(marketingProfile.skills).toEqual(expect.arrayContaining(['HubSpot', 'Salesforce', 'Twilio', 'Convoso']));
    // "Lead scoring" from the skills section is canonicalized.
    expect(marketingProfile.skills).toContain('Lead Scoring');
    // "Marketo" only appears in a bullet, never in a skills group.
    expect(marketingProfile.skills).toContain('Marketo');
    expect(new Set(marketingProfile.skills).size).toBe(marketingProfile.skills.length);
  });

  it("keeps unknown skills in the user's own casing", () => {
    const resume = createSampleResume();
    resume.skillGroups = [createSkillGroup({ name: 'Other', skills: ['Resort Tour Booking', 'DID Health Monitoring'] })];
    const profile = resumeProfile(resume);
    expect(profile.skills).toContain('Resort Tour Booking');
    expect(profile.skills).toContain('DID Health Monitoring');
  });

  it('collects titles and the headline', () => {
    expect(marketingProfile.titles).toEqual(['Marketing Operations Manager', 'Marketing Automation Specialist']);
    expect(marketingProfile.headline).toBe('Marketing Operations Manager');
  });

  it('computes years of experience from date ranges, merging overlaps', () => {
    const items = [
      createExperienceItem({ startDate: '2018-01', endDate: '2020-12' }), // 36 months
      createExperienceItem({ startDate: '2020-01', endDate: '2021-12' }), // overlaps → extends to 2021-12
      createExperienceItem({ startDate: '2023-01', endDate: '2023-06' }), // 6 months
    ];
    expect(experienceMonths(items, new Date('2025-01-15T00:00:00Z'))).toBe(48 + 6);
    expect(yearsOfExperience(items, new Date('2025-01-15T00:00:00Z'))).toBe(4.5);
  });

  it('runs a current role up to today and ignores unparseable dates', () => {
    const items = [
      createExperienceItem({ startDate: '2024-01', endDate: '', current: true }),
      createExperienceItem({ startDate: 'whenever', endDate: 'later' }),
    ];
    expect(experienceMonths(items, new Date('2025-01-15T00:00:00Z'))).toBe(13);
    expect(experienceMonths([], new Date())).toBe(0);
  });
});

describe('titleSimilarity', () => {
  it('treats engineer and developer as near-synonyms', () => {
    expect(titleSimilarity('Backend Developer', ['Backend Engineer'])).toBeGreaterThan(0.9);
  });

  it('normalizes seniority prefixes', () => {
    expect(titleSimilarity('Sr. Data Analyst', ['Senior Data Analyst'])).toBeGreaterThan(0.9);
    expect(titleSimilarity('Data Analyst', ['Senior Data Analyst'])).toBeGreaterThan(0.8);
  });

  it('penalizes a large seniority gap', () => {
    const wide = titleSimilarity('Director of Marketing', ['Marketing Intern']);
    const close = titleSimilarity('Director of Marketing', ['Marketing Manager']);
    expect(wide).toBeLessThan(close);
  });

  it('is 0 for unrelated titles and empty input', () => {
    expect(titleSimilarity('Registered Nurse', ['Backend Engineer'])).toBe(0);
    expect(titleSimilarity('', ['Backend Engineer'])).toBe(0);
    expect(titleSimilarity('Backend Engineer', [])).toBe(0);
  });

  it('uses the headline when no titles are present', () => {
    expect(titleSimilarity('Marketing Operations Manager', [], 'Marketing Operations Manager')).toBe(1);
  });
});

describe('scoreJobMatch', () => {
  it('ranks an on-target job far above an unrelated one', () => {
    const good = scoreJobMatch(marketingProfile, MARKETING_OPS_JOB);
    const bad = scoreJobMatch(marketingProfile, NURSE_JOB);
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.score - bad.score).toBeGreaterThan(30);
    expect(good.score).toBeGreaterThanOrEqual(55);
    expect(bad.score).toBeLessThan(40);
  });

  it('reports matched and missing skills, required ones first', () => {
    const result = scoreJobMatch(marketingProfile, MARKETING_OPS_JOB);
    expect(result.matchedSkills).toEqual(expect.arrayContaining(['HubSpot', 'Salesforce', 'Lead Scoring']));
    expect(result.missingSkills).not.toContain('HubSpot');
    // Everything the resume lacks that the posting requires appears before nice-to-haves.
    const twilioIndex = result.missingSkills.indexOf('Twilio');
    expect(twilioIndex).toBe(-1); // the sample resume has Twilio
  });

  it('orders missing skills required-first', () => {
    const profile: ResumeProfile = { skills: ['Python'], titles: ['Backend Engineer'], headline: '', text: 'Python', yearsExperience: 3 };
    const result = scoreJobMatch(
      profile,
      job({
        title: 'Backend Engineer',
        descriptionText: 'Requirements: Python, Kubernetes and PostgreSQL.\nNice to have: Terraform.',
      }),
    );
    const kubernetes = result.missingSkills.indexOf('Kubernetes');
    const terraform = result.missingSkills.indexOf('Terraform');
    expect(kubernetes).toBeGreaterThanOrEqual(0);
    expect(terraform).toBeGreaterThan(kubernetes);
  });

  it('returns 2–4 short reasons', () => {
    for (const target of [MARKETING_OPS_JOB, NURSE_JOB]) {
      const { reasons } = scoreJobMatch(marketingProfile, target);
      expect(reasons.length).toBeGreaterThanOrEqual(2);
      expect(reasons.length).toBeLessThanOrEqual(4);
      for (const reason of reasons) {
        expect(reason.length).toBeGreaterThan(0);
        expect(reason.length).toBeLessThanOrEqual(60);
      }
    }
    expect(scoreJobMatch(marketingProfile, MARKETING_OPS_JOB).reasons[0]).toMatch(/^\d+ of \d+ required skills$/);
  });

  it('falls back to title and keywords when nothing is detectable', () => {
    const result = scoreJobMatch(marketingProfile, job({ title: 'Underwater Basket Weaver' }));
    expect(result.reasons).toContain('Few requirements detected');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(40);
  });

  it('still scores a job whose only content is a title and tags', () => {
    const result = scoreJobMatch(
      marketingProfile,
      job({ title: 'Marketing Operations Manager', tags: ['hubspot', 'salesforce'], descriptionText: '' }),
    );
    expect(result.matchedSkills).toEqual(expect.arrayContaining(['HubSpot', 'Salesforce']));
    expect(result.score).toBeGreaterThan(60);
  });

  it('caps the score when there is nothing to check requirements against', () => {
    const result = scoreJobMatch(marketingProfile, job({ title: 'Marketing Operations Manager' }));
    expect(result.reasons).toContain('Few requirements detected');
    expect(result.titleSimilarity).toBe(1);
    expect(result.score).toBeLessThanOrEqual(70);
  });

  it('never reports junk word pairs as missing skills', () => {
    for (const target of [MARKETING_OPS_JOB, NURSE_JOB]) {
      for (const missing of scoreJobMatch(marketingProfile, target).missingSkills) {
        expect(missing).not.toMatch(/\bNice\b/);
        expect(missing.split(/\s+/).length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('handles an empty profile and an empty job without throwing', () => {
    const empty: ResumeProfile = { skills: [], titles: [], headline: '', text: '', yearsExperience: 0 };
    const result = scoreJobMatch(empty, job({}));
    expect(result.score).toBe(0);
    expect(result.matchedSkills).toEqual([]);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic across calls and across equivalent profiles', () => {
    const first = scoreJobMatch(marketingProfile, MARKETING_OPS_JOB);
    const fresh = resumeProfile(createSampleResume(), new Date('2025-06-15T00:00:00Z'));
    expect(scoreJobMatch(fresh, MARKETING_OPS_JOB)).toEqual(first);
    for (let i = 0; i < 5; i++) {
      expect(scoreJobMatch(marketingProfile, MARKETING_OPS_JOB)).toEqual(first);
      expect(scoreJobMatch(marketingProfile, NURSE_JOB)).toEqual(scoreJobMatch(fresh, NURSE_JOB));
    }
  });

  it('accepts a full Job object', () => {
    const full: Job = {
      id: 'remotive:1',
      source: 'remotive',
      sourceId: '1',
      title: 'Marketing Operations Manager',
      company: 'Acme',
      location: 'Remote',
      remote: true,
      tags: ['hubspot'],
      descriptionHtml: '',
      descriptionText: MARKETING_OPS_JOB.descriptionText,
      url: 'https://example.com',
      postedAt: '2025-01-01T00:00:00.000Z',
      fetchedAt: '2025-01-02T00:00:00.000Z',
    };
    expect(scoreJobMatch(marketingProfile, full).score).toBeGreaterThan(50);
  });

  it('keeps titleSimilarity in 0–1 and the score an integer 0–100', () => {
    for (const target of [MARKETING_OPS_JOB, NURSE_JOB, job({ title: 'Chef' })]) {
      const result = scoreJobMatch(marketingProfile, target);
      expect(Number.isInteger(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.titleSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.titleSimilarity).toBeLessThanOrEqual(1);
    }
  });
});

describe('matchLabel', () => {
  it('buckets scores into labels and tones', () => {
    expect(matchLabel(100)).toEqual({ label: 'Excellent', tone: 'success' });
    expect(matchLabel(85)).toEqual({ label: 'Excellent', tone: 'success' });
    expect(matchLabel(84)).toEqual({ label: 'Strong', tone: 'success' });
    expect(matchLabel(70)).toEqual({ label: 'Strong', tone: 'success' });
    expect(matchLabel(69)).toEqual({ label: 'Good', tone: 'info' });
    expect(matchLabel(55)).toEqual({ label: 'Good', tone: 'info' });
    expect(matchLabel(54)).toEqual({ label: 'Fair', tone: 'warning' });
    expect(matchLabel(40)).toEqual({ label: 'Fair', tone: 'warning' });
    expect(matchLabel(39)).toEqual({ label: 'Low', tone: 'danger' });
    expect(matchLabel(0)).toEqual({ label: 'Low', tone: 'danger' });
    expect(matchLabel(Number.NaN)).toEqual({ label: 'Low', tone: 'danger' });
  });
});
