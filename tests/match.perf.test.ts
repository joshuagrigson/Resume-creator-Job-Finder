import { describe, expect, it } from 'vitest';
import { type MatchableJob, scoreJobMatch } from '@shared/match';
import { createSampleResume } from '@/lib/resume/defaults';
import { resumeProfile } from '@/lib/resume/profile';

const STACKS = [
  ['HubSpot', 'Salesforce', 'Marketo', 'GA4', 'lead scoring'],
  ['Python', 'PostgreSQL', 'Docker', 'Kubernetes', 'CI/CD'],
  ['React', 'TypeScript', 'Node.js', 'GraphQL', 'Jest'],
  ['Convoso', 'Five9', 'Twilio', 'call center operations', 'coaching'],
  ['Epic EMR', 'HIPAA', 'patient assessment', 'wound care', 'BLS'],
  ['forklift', 'OSHA', 'inventory management', 'warehouse operations', 'CDL'],
  ['QuickBooks', 'payroll', 'accounts payable', 'GAAP', 'month-end close'],
  ['Figma', 'user research', 'design systems', 'prototyping', 'accessibility'],
];

const TITLES = [
  'Marketing Operations Manager',
  'Senior Backend Engineer',
  'Frontend Developer',
  'Call Center Operations Manager',
  'Registered Nurse',
  'Warehouse Associate',
  'Staff Accountant',
  'Product Designer',
];

function buildJob(index: number): MatchableJob {
  const stack = STACKS[index % STACKS.length];
  const title = TITLES[index % TITLES.length];
  return {
    title: `${title} #${index}`,
    category: 'General',
    tags: stack.slice(0, 3).map((t) => t.toLowerCase()),
    descriptionText: `About the role
We are hiring a ${title} to join a growing team. You will own delivery end to end and partner
with stakeholders across the business to ship measurable outcomes every quarter.

Requirements:
- 4+ years of hands-on experience with ${stack[0]} and ${stack[1]}
- Proven track record with ${stack[2]}
- Strong communication and problem solving skills
- Comfortable working in a fast paced, remote-first environment

Nice to have:
- Exposure to ${stack[3]}
- Familiarity with ${stack[4]}

We offer competitive compensation, health benefits and a flexible schedule.`,
  };
}

describe('scoreJobMatch performance', () => {
  it('scores 2000 jobs in well under 1.5 s', () => {
    const profile = resumeProfile(createSampleResume(), new Date('2025-06-15T00:00:00Z'));
    const jobs = Array.from({ length: 2000 }, (_, i) => buildJob(i));
    // Warm the profile cache and the JIT the same way a real search would.
    scoreJobMatch(profile, jobs[0]);

    const started = performance.now();
    let total = 0;
    for (const job of jobs) total += scoreJobMatch(profile, job).score;
    const elapsed = performance.now() - started;

    expect(total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1500);
  });

  it('produces identical results on a second pass over the same jobs', () => {
    const profile = resumeProfile(createSampleResume(), new Date('2025-06-15T00:00:00Z'));
    const jobs = Array.from({ length: 50 }, (_, i) => buildJob(i));
    const first = jobs.map((job) => scoreJobMatch(profile, job));
    const second = jobs.map((job) => scoreJobMatch(profile, job));
    expect(second).toEqual(first);
  });
});
