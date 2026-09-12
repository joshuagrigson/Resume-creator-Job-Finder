import type {
  CertificationItem,
  CustomSection,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  Resume,
  ResumeStyle,
  SkillGroup,
} from '@shared/types';
import { nowIso, uid } from '@/lib/id';

export const DEFAULT_STYLE: ResumeStyle = {
  template: 'modern',
  accentColor: '#1f5eff',
  font: 'sans',
  fontSize: 10.5,
  density: 'normal',
  pageSize: 'letter',
  sectionOrder: ['summary', 'experience', 'skills', 'education', 'projects', 'certifications'],
  hiddenSections: [],
};

export function createExperienceItem(partial: Partial<ExperienceItem> = {}): ExperienceItem {
  return {
    id: uid('exp'),
    company: '',
    title: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    bullets: [''],
    ...partial,
  };
}

export function createEducationItem(partial: Partial<EducationItem> = {}): EducationItem {
  return {
    id: uid('edu'),
    school: '',
    degree: '',
    field: '',
    location: '',
    startDate: '',
    endDate: '',
    gpa: '',
    details: [],
    ...partial,
  };
}

export function createSkillGroup(partial: Partial<SkillGroup> = {}): SkillGroup {
  return { id: uid('skl'), name: '', skills: [], ...partial };
}

export function createProjectItem(partial: Partial<ProjectItem> = {}): ProjectItem {
  return { id: uid('prj'), name: '', url: '', description: '', bullets: [], technologies: [], ...partial };
}

export function createCertificationItem(partial: Partial<CertificationItem> = {}): CertificationItem {
  return { id: uid('crt'), name: '', issuer: '', date: '', url: '', ...partial };
}

export function createCustomSection(partial: Partial<CustomSection> = {}): CustomSection {
  return { id: uid('sec'), title: 'New section', items: [], ...partial };
}

/** A blank resume with one empty experience row so the editor never starts empty. */
export function createBlankResume(name = 'Untitled resume'): Resume {
  const ts = nowIso();
  return {
    id: uid('res'),
    name,
    createdAt: ts,
    updatedAt: ts,
    contact: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
      github: '',
    },
    summary: '',
    experience: [createExperienceItem()],
    education: [],
    skillGroups: [createSkillGroup({ name: 'Skills' })],
    projects: [],
    certifications: [],
    customSections: [],
    style: { ...DEFAULT_STYLE, sectionOrder: [...DEFAULT_STYLE.sectionOrder], hiddenSections: [] },
  };
}

/** A realistic, fully filled sample resume for previews, demos, and tests. */
export function createSampleResume(): Resume {
  const base = createBlankResume('Sample — Marketing Operations');
  return {
    ...base,
    contact: {
      fullName: 'Jordan Rivera',
      headline: 'Marketing Operations Manager',
      email: 'jordan.rivera@example.com',
      phone: '(903) 555-0142',
      location: 'Texarkana, TX',
      website: 'jordanrivera.dev',
      linkedin: 'linkedin.com/in/jordanrivera',
      github: '',
    },
    summary:
      'Marketing operations leader with 8+ years building call-center pipelines, automation, and dashboards that turn leads into booked appointments. Cut cost-per-tour 31% and lifted show rate from 42% to 58% by pairing rep coaching with data.',
    experience: [
      createExperienceItem({
        company: 'Ocean Canyon Resorts',
        title: 'Marketing Operations Manager',
        location: 'Texarkana, TX',
        startDate: '2021-03',
        endDate: '',
        current: true,
        bullets: [
          'Lead a 14-rep call center that books 900+ resort tours per month; raised show rate from 42% to 58% in 12 months through a benchmark-call coaching program.',
          'Built HubSpot + Twilio automations that recover 22% of missed calls automatically, adding roughly 190 booked tours per quarter.',
          'Designed a DID health dashboard that flags spam-labeled numbers within 24 hours, cutting wasted dials by 35%.',
          'Own the lead-scoring model (Salesforce, Convoso) that routes high-intent leads to top reps, improving contact rate 18%.',
        ],
      }),
      createExperienceItem({
        company: 'BrightPath Media',
        title: 'Marketing Automation Specialist',
        location: 'Dallas, TX',
        startDate: '2017-06',
        endDate: '2021-02',
        current: false,
        bullets: [
          'Managed 40+ multi-channel campaigns per quarter across email, SMS, and paid social for 12 client accounts.',
          'Migrated 1.2M-contact database from Marketo to HubSpot with zero data loss and 3 weeks ahead of schedule.',
          'Introduced A/B testing standards that raised email click-through rate 27% year over year.',
        ],
      }),
    ],
    education: [
      createEducationItem({
        school: 'Texas A&M University–Texarkana',
        degree: 'B.B.A.',
        field: 'Marketing',
        location: 'Texarkana, TX',
        startDate: '2013-08',
        endDate: '2017-05',
        gpa: '3.7',
        details: [],
      }),
    ],
    skillGroups: [
      createSkillGroup({
        name: 'Marketing & Sales Ops',
        skills: ['Lead scoring', 'Call center operations', 'Campaign management', 'A/B testing', 'Sales coaching', 'Forecasting'],
      }),
      createSkillGroup({
        name: 'Tools',
        skills: ['HubSpot', 'Salesforce', 'Twilio', 'Convoso', 'GoHighLevel', 'Google Analytics', 'Excel', 'SQL'],
      }),
      createSkillGroup({ name: 'Technical', skills: ['JavaScript', 'Python', 'Cloudflare Workers', 'Zapier', 'REST APIs'] }),
    ],
    projects: [
      createProjectItem({
        name: 'Agent Coaching Platform',
        url: '',
        description: 'Internal web app that pulls call recordings, transcribes them, and grades reps against an 11-point benchmark.',
        bullets: ['Adopted by 3 call centers; reduced QA review time per call from 25 minutes to 6.'],
        technologies: ['JavaScript', 'Cloudflare Pages', 'Whisper'],
      }),
    ],
    certifications: [
      createCertificationItem({ name: 'HubSpot Marketing Software', issuer: 'HubSpot Academy', date: '2022-04', url: '' }),
      createCertificationItem({ name: 'Google Analytics 4', issuer: 'Google', date: '2023-01', url: '' }),
    ],
  };
}

/** Deep-clone a resume with a new id/name (used by "Duplicate"). */
export function cloneResume(resume: Resume, name?: string): Resume {
  const copy: Resume = JSON.parse(JSON.stringify(resume));
  const ts = nowIso();
  copy.id = uid('res');
  copy.name = name ?? `${resume.name} (copy)`;
  copy.createdAt = ts;
  copy.updatedAt = ts;
  delete copy.tailoredForJobId;
  return copy;
}
