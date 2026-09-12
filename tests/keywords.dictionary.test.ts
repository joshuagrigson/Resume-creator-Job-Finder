import { describe, expect, it } from 'vitest';
import {
  SKILL_DICTIONARY,
  canonicalSkillFor,
  extractKeywords,
  extractRequirements,
  extractSkills,
  isCanonicalSkill,
  skillCategory,
} from '@shared/keywords';
import { tokenizeAll } from '@shared/text';

describe('SKILL_DICTIONARY', () => {
  it('has at least 400 entries across every category', () => {
    expect(SKILL_DICTIONARY.length).toBeGreaterThanOrEqual(400);
    const categories = new Set(SKILL_DICTIONARY.map((e) => e.category));
    for (const category of [
      'language',
      'framework',
      'tool',
      'cloud',
      'data',
      'design',
      'marketing',
      'sales',
      'ops',
      'soft',
      'finance',
      'healthcare',
      'trades',
      'other',
    ]) {
      expect(categories.has(category as never)).toBe(true);
    }
  });

  it('covers white-collar, call-center and blue-collar fields', () => {
    const canonical = new Set(SKILL_DICTIONARY.map((e) => e.canonical));
    for (const skill of [
      'JavaScript', 'Kubernetes', 'Tableau', 'Figma', 'Cybersecurity',
      'HubSpot', 'Marketo', 'Google Ads', 'Meta Ads', 'GA4', 'Email Marketing', 'CRM',
      'Marketing Automation', 'Lead Generation', 'Lead Scoring', 'Copywriting', 'Content Marketing',
      'Campaign Management', 'Salesforce', 'Convoso', 'Five9', 'Twilio', 'GoHighLevel', 'Zendesk',
      'Predictive Dialer', 'Cold Calling', 'Appointment Setting', 'Inbound Sales', 'Outbound Sales',
      'Call Quality Assurance', 'Coaching', 'Pipeline Management', 'Quota Attainment',
      'Microsoft Excel', 'QuickBooks', 'SAP', 'Payroll', 'Recruiting', 'Applicant Tracking System',
      'Forecasting', 'Budgeting', 'P&L Management', 'Six Sigma', 'Project Management', 'PMP',
      'Agile', 'Scrum', 'Jira',
      'Registered Nurse', 'Certified Nursing Assistant', 'EMR', 'Epic', 'HIPAA', 'Phlebotomy',
      'CDL', 'Forklift Operation', 'OSHA', 'HVAC', 'Welding', 'Warehouse Management', 'Inventory Management',
      'POS Systems', 'Customer Service', 'Upselling',
      'Leadership', 'Communication', 'Mentoring', 'Negotiation', 'Public Speaking', 'Problem Solving',
      'Time Management',
    ]) {
      expect(canonical.has(skill), `missing ${skill}`).toBe(true);
    }
  });

  it('never registers the same alias for two different skills', () => {
    const owner = new Map<string, string>();
    const collisions: string[] = [];
    for (const entry of SKILL_DICTIONARY) {
      for (const alias of [entry.canonical, ...entry.aliases]) {
        const key = tokenizeAll(alias).join(' ');
        expect(key, `alias "${alias}" of ${entry.canonical} tokenizes to nothing`).not.toBe('');
        const previous = owner.get(key);
        if (previous && previous !== entry.canonical) collisions.push(`${key}: ${previous} vs ${entry.canonical}`);
        else owner.set(key, entry.canonical);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('keeps canonical names in natural casing and aliases lowercase', () => {
    for (const entry of SKILL_DICTIONARY) {
      expect(entry.canonical.trim()).toBe(entry.canonical);
      expect(entry.canonical.length).toBeGreaterThan(0);
      for (const alias of entry.aliases) expect(alias).toBe(alias.toLowerCase());
    }
    expect(isCanonicalSkill('JavaScript')).toBe(true);
    expect(isCanonicalSkill('javascript')).toBe(false);
    expect(skillCategory('HubSpot')).toBe('marketing');
  });
});

describe('canonicalSkillFor', () => {
  it('maps aliases and casings onto the canonical name', () => {
    expect(canonicalSkillFor('hub spot')).toBe('HubSpot');
    expect(canonicalSkillFor('NODE.JS')).toBe('Node.js');
    expect(canonicalSkillFor('customer support')).toBe('Customer Service');
    expect(canonicalSkillFor('golang')).toBe('Go');
    // Explicitly listed skills bypass the ambiguity rules.
    expect(canonicalSkillFor('Go')).toBe('Go');
    expect(canonicalSkillFor('Excel')).toBe('Microsoft Excel');
  });

  it('returns null for unknown or empty input', () => {
    expect(canonicalSkillFor('')).toBeNull();
    expect(canonicalSkillFor('underwater basket weaving')).toBeNull();
  });
});

describe('extractSkills', () => {
  it('finds alias and multi-word skills, longest match first', () => {
    const text = 'Hands-on with Node.js, C++, CI/CD pipelines, A/B testing, customer service and HubSpot.';
    expect(extractSkills(text)).toEqual(['Node.js', 'C++', 'CI/CD', 'A/B Testing', 'Customer Service', 'HubSpot']);
  });

  it('prefers the longest alias when phrases overlap', () => {
    expect(extractSkills('We run Google Analytics 4 dashboards')).toContain('GA4');
    expect(extractSkills('We run Google Analytics 4 dashboards')).not.toContain('Google Analytics');
    expect(extractSkills('Salesforce Marketing Cloud admin')).toEqual(['Salesforce Marketing Cloud']);
  });

  it('returns canonical names in order of first appearance, deduped', () => {
    expect(extractSkills('Python, then SQL, then Python again')).toEqual(['Python', 'SQL']);
  });

  it('is case-insensitive and respects token boundaries', () => {
    expect(extractSkills('HUBSPOT and hubspot and HubSpot')).toEqual(['HubSpot']);
    expect(extractSkills('javascripting is not a word')).toEqual([]);
  });

  it('does not fire on common English that happens to spell a skill', () => {
    expect(extractSkills('go to the store')).toEqual([]);
    expect(extractSkills('You excel at building rapport with guests.')).not.toContain('Microsoft Excel');
    expect(extractSkills('People react to change differently.')).not.toContain('React');
    expect(extractSkills('Keep the work area safe and clean.')).not.toContain('SAFe');
    expect(extractSkills('An epic week for the team.')).not.toContain('Epic');
    expect(extractSkills('Lean on your teammates.')).not.toContain('Lean Manufacturing');
  });

  it('does fire when the surrounding context is technical', () => {
    expect(extractSkills('Backend engineer writing Go and Kubernetes operators')).toEqual(['Go', 'Kubernetes']);
    expect(extractSkills('Advanced Excel including pivot tables and VLOOKUP')).toContain('Microsoft Excel');
    expect(extractSkills('Frontend developer: React, Redux, TypeScript')).toContain('React');
    expect(extractSkills('Charting in Epic EMR for every patient')).toContain('Epic');
    expect(extractSkills('Lean Six Sigma green belt')).toContain('Six Sigma');
  });

  it('reads HTML descriptions as well as plain text', () => {
    expect(extractSkills('<ul><li>HubSpot</li><li>Google&nbsp;Ads</li></ul>')).toEqual(['HubSpot', 'Google Ads']);
  });

  it('handles empty input', () => {
    expect(extractSkills('')).toEqual([]);
    expect(extractSkills('   ')).toEqual([]);
  });

  it('stays fast on a 20 KB job description', () => {
    const block =
      'We are hiring a marketing operations manager to own HubSpot, Salesforce and Marketo. ' +
      'You will build lead scoring models, run A/B testing on landing pages, and report in GA4 and Looker. ' +
      'Bonus: SQL, Python, Zapier, Twilio, and call center reporting for our inbound sales team. ';
    const jd = block.repeat(Math.ceil(20_000 / block.length));
    expect(jd.length).toBeGreaterThan(20_000);
    extractSkills(jd);
    const started = performance.now();
    const skills = extractSkills(jd);
    const elapsed = performance.now() - started;
    expect(skills).toContain('HubSpot');
    expect(elapsed).toBeLessThan(25);
  });
});

describe('extractKeywords', () => {
  const jd = `Marketing Operations Manager
    You will own our HubSpot instance and the lead scoring model. HubSpot workflows, HubSpot reporting
    and lead scoring accuracy are the core of this role. Strong SQL skills required. SQL and HubSpot
    experience matter more than anything else on this team.`;

  it('ranks frequent, meaningful terms and returns counts', () => {
    const hits = extractKeywords(jd, 8);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(8);
    const terms = hits.map((h) => h.term);
    expect(terms).toContain('HubSpot');
    expect(terms).toContain('SQL');
    for (const hit of hits) expect(hit.count).toBeGreaterThan(0);
  });

  it('drops stopwords and job-ad boilerplate', () => {
    const terms = extractKeywords(jd, 20).map((h) => h.term.toLowerCase());
    for (const noise of ['the', 'you', 'team', 'role', 'experience', 'strong', 'required']) {
      expect(terms).not.toContain(noise);
    }
  });

  it('surfaces multi-word phrases', () => {
    const terms = extractKeywords(jd, 20).map((h) => h.term.toLowerCase());
    expect(terms).toContain('lead scoring');
  });

  it('is deterministic and honours the limit', () => {
    expect(extractKeywords(jd, 5)).toEqual(extractKeywords(jd, 5));
    expect(extractKeywords(jd, 5).length).toBeLessThanOrEqual(5);
    expect(extractKeywords(jd, 0)).toEqual([]);
    expect(extractKeywords('', 10)).toEqual([]);
    expect(extractKeywords('   ')).toEqual([]);
  });
});

describe('extractRequirements', () => {
  it('splits required from nice-to-have using section headings', () => {
    const jd = `About the role
      We are hiring a backend engineer.

      Requirements:
      - 5+ years with Python and PostgreSQL
      - Experience with Docker and Kubernetes

      Nice to have:
      - Terraform
      - Kafka`;
    const { required, niceToHave } = extractRequirements(jd);
    expect(required).toEqual(expect.arrayContaining(['Python', 'PostgreSQL', 'Docker', 'Kubernetes']));
    expect(niceToHave).toEqual(expect.arrayContaining(['Terraform', 'Apache Kafka']));
    expect(required).not.toContain('Terraform');
    expect(niceToHave).not.toContain('Python');
  });

  it('treats "preferred qualifications" as nice-to-have, not as a qualifications heading', () => {
    const jd = `Minimum qualifications:\nSQL\n\nPreferred qualifications:\nTableau`;
    const { required, niceToHave } = extractRequirements(jd);
    expect(required).toContain('SQL');
    expect(niceToHave).toContain('Tableau');
  });

  it('handles inline cues inside a single sentence', () => {
    const { required, niceToHave } = extractRequirements(
      'Must have Salesforce administration. Experience with Marketo is a plus.',
    );
    expect(required).toContain('Salesforce');
    expect(niceToHave).toContain('Marketo');
  });

  it('puts everything in required when there are no cues', () => {
    const { required, niceToHave } = extractRequirements('We use HubSpot, Twilio and Convoso every day.');
    expect(required).toEqual(['HubSpot', 'Twilio', 'Convoso']);
    expect(niceToHave).toEqual([]);
  });

  it('never lists a skill as both required and nice-to-have', () => {
    const { required, niceToHave } = extractRequirements(
      'Requirements: Python. Nice to have: Python at scale and Docker.',
    );
    expect(required).toContain('Python');
    expect(niceToHave).not.toContain('Python');
    expect(niceToHave).toContain('Docker');
  });

  it('returns empty lists for empty input', () => {
    expect(extractRequirements('')).toEqual({ required: [], niceToHave: [] });
    expect(extractRequirements('   \n  ')).toEqual({ required: [], niceToHave: [] });
  });
});
