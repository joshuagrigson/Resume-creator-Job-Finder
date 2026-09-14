import { DEFAULT_STYLE } from '../src/lib/resume/defaults';
import { describe, expect, it } from 'vitest';
import { RESUME_SCHEMA_VERSION } from '@shared/types';
import type { Resume } from '@shared/types';
import { ResumeSchema, normalizeImportedResume } from '@/lib/resume/validate';
import { createSampleResume } from '@/lib/resume/defaults';

function ok(result: ReturnType<typeof normalizeImportedResume>): { resume: Resume; warnings: string[] } {
  if ('error' in result) throw new Error(`expected success, got: ${result.error}`);
  return result;
}

const JSON_RESUME = {
  $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
  basics: {
    name: 'Ada Lovelace',
    label: 'Analytical Engineer',
    email: 'ada@example.com',
    phone: '(512) 555-0100',
    url: 'https://ada.example.com',
    summary: 'Mathematician who wrote the first published algorithm.',
    location: { city: 'Austin', region: 'TX', countryCode: 'US' },
    profiles: [
      { network: 'LinkedIn', url: 'linkedin.com/in/ada' },
      { network: 'GitHub', url: 'github.com/ada' },
    ],
  },
  work: [
    {
      name: 'Analytical Engine Co',
      position: 'Lead Engineer',
      location: 'Austin, TX',
      startDate: '2019-03-01',
      endDate: '2023-07',
      summary: 'Owned the compute roadmap.',
      highlights: ['Shipped the first program, cutting calculation time 80%.'],
    },
    { name: 'Current Works', position: 'Principal', startDate: '2023-08' },
  ],
  education: [
    {
      institution: 'University of Texas at Austin',
      studyType: 'B.S.',
      area: 'Mathematics',
      startDate: '2015',
      endDate: 'March 2019',
      score: '3.9',
      courses: ['Numerical analysis'],
    },
  ],
  skills: [
    { name: 'Mathematics', keywords: ['Algorithms', 'Analysis'] },
    { name: 'Technical Writing' },
  ],
  projects: [{ name: 'Note G', url: 'ada.example.com/noteg', description: 'First algorithm.', highlights: ['Widely cited.'], keywords: ['Math'] }],
  certificates: [{ name: 'Royal Society Fellow', issuer: 'Royal Society', date: '2020-05-01' }],
  awards: [{ title: 'Gold Medal', awarder: 'Royal Society', date: '2021', summary: 'For the notes.' }],
  volunteer: [{ organization: 'STEM Club', position: 'Mentor', startDate: '2020', summary: 'Mentored students.' }],
  languages: [{ language: 'English' }],
  interests: [{ name: 'Music' }],
};

describe('ResumeSchema', () => {
  it('accepts a real resume unchanged in shape', () => {
    const sample = createSampleResume();
    const parsed = ResumeSchema.parse(sample);
    expect(parsed.contact.fullName).toBe(sample.contact.fullName);
    expect(parsed.experience).toHaveLength(sample.experience.length);
    expect(parsed.style.template).toBe(sample.style.template);
  });

  it('strips unknown keys and falls back on bad values', () => {
    const parsed = ResumeSchema.parse({
      name: 'X',
      summary: 42,
      experience: 'nope',
      style: { template: 'holographic', fontSize: 'big' },
      surprise: { nested: true },
    });
    expect(parsed).not.toHaveProperty('surprise');
    expect(parsed.summary).toBe('');
    expect(parsed.experience).toEqual([]);
    expect(parsed.style.fontSize).toBe(10.5);
  });
});

describe('normalizeImportedResume — our own formats', () => {
  it('accepts the { schemaVersion, resume } export envelope', () => {
    const sample = createSampleResume();
    const { resume, warnings } = ok(normalizeImportedResume({ schemaVersion: RESUME_SCHEMA_VERSION, resume: sample }));
    expect(resume.contact.fullName).toBe('Jordan Rivera');
    expect(resume.experience).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  it('accepts a bare resume object and a JSON string', () => {
    const sample = createSampleResume();
    expect(ok(normalizeImportedResume(sample)).resume.summary).toBe(sample.summary);
    expect(ok(normalizeImportedResume(JSON.stringify(sample))).resume.summary).toBe(sample.summary);
  });

  it('accepts an all-resumes export and warns that only the first was imported', () => {
    const a = createSampleResume();
    const b = { ...createSampleResume(), name: 'Second' };
    const result = ok(normalizeImportedResume({ resumes: [a, b] }));
    expect(result.resume.contact.fullName).toBe('Jordan Rivera');
    expect(result.warnings.join(' ')).toContain('imported the first one');

    const fromArray = ok(normalizeImportedResume([a, b]));
    expect(fromArray.warnings.join(' ')).toContain('imported the first one');
  });

  it('warns when the file came from a newer schema version', () => {
    const result = ok(normalizeImportedResume({ schemaVersion: RESUME_SCHEMA_VERSION + 5, resume: createSampleResume() }));
    expect(result.warnings.join(' ')).toContain('newer version');
  });

  it('accepts a partial object and fills the rest from a blank resume', () => {
    const { resume } = ok(normalizeImportedResume({ contact: { fullName: 'Pat Moss' } }));
    expect(resume.contact.fullName).toBe('Pat Moss');
    expect(resume.contact.email).toBe('');
    expect(resume.experience).toEqual([]);
    expect(resume.style.sectionOrder).toContain('experience');
    expect(resume.name).toBe('Pat Moss');
  });

  it('always issues a fresh resume id so importing twice never overwrites', () => {
    const sample = createSampleResume();
    const first = ok(normalizeImportedResume(sample)).resume;
    const second = ok(normalizeImportedResume(sample)).resume;
    expect(first.id).not.toBe(sample.id);
    expect(first.id).not.toBe(second.id);
  });
});

describe('normalizeImportedResume — ids, dates and style', () => {
  it('regenerates missing and colliding item ids', () => {
    const { resume } = ok(
      normalizeImportedResume({
        contact: { fullName: 'Dup Test' },
        experience: [
          { id: 'same', company: 'A', bullets: ['Shipped 4 things.'] },
          { id: 'same', company: 'B', bullets: ['Shipped 5 things.'] },
          { company: 'C', bullets: ['Shipped 6 things.'] },
        ],
      }),
    );
    const ids = resume.experience.map((item) => item.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(ids[0]).toBe('same');
  });

  it('keeps custom section references in sectionOrder pointing at the remapped id', () => {
    const { resume } = ok(
      normalizeImportedResume({
        contact: { fullName: 'Custom Test' },
        customSections: [
          { id: 'dup', title: 'Awards', items: [{ id: 'i1', heading: 'A', bullets: ['Won.'] }] },
          { id: 'dup', title: 'Volunteer', items: [{ id: 'i1', heading: 'B', bullets: ['Helped.'] }] },
        ],
        style: { sectionOrder: ['summary', 'custom:dup', 'custom:ghost'] },
      }),
    );
    const [first, second] = resume.customSections;
    expect(first.id).not.toBe(second.id);
    expect(resume.style.sectionOrder).toContain(`custom:${first.id}`);
    expect(resume.style.sectionOrder).toContain(`custom:${second.id}`);
    expect(resume.style.sectionOrder).not.toContain('custom:ghost');
    expect(resume.customSections[0].items[0].id).not.toBe(resume.customSections[1].items[0].id);
  });

  it('coerces dates to YYYY-MM and reports the ones it could not read', () => {
    const { resume, warnings } = ok(
      normalizeImportedResume({
        contact: { fullName: 'Date Test' },
        experience: [
          { company: 'A', startDate: '2021-03-01', endDate: 'March 2023' },
          { company: 'B', startDate: '2019', endDate: 'whenever' },
        ],
      }),
    );
    expect(resume.experience[0].startDate).toBe('2021-03');
    expect(resume.experience[0].endDate).toBe('2023-03');
    expect(resume.experience[1].startDate).toBe('2019-01');
    expect(resume.experience[1].endDate).toBe('');
    expect(warnings.join(' ')).toContain('Could not read 1 date');
  });

  it('clamps and repairs style values', () => {
    const { resume, warnings } = ok(
      normalizeImportedResume({
        contact: { fullName: 'Style Test' },
        style: {
          template: 'holographic',
          accentColor: 'ultraviolet',
          fontSize: 42,
          sectionOrder: ['experience', 'experience', 'not-a-section'],
          hiddenSections: ['projects', 'nope'],
        },
      }),
    );
    expect(resume.style.template).toBe('modern');
    expect(resume.style.accentColor).toBe(DEFAULT_STYLE.accentColor);
    expect(resume.style.fontSize).toBe(12);
    expect(resume.style.sectionOrder[0]).toBe('experience');
    expect(new Set(resume.style.sectionOrder).size).toBe(resume.style.sectionOrder.length);
    expect(resume.style.sectionOrder).toContain('summary');
    expect(resume.style.hiddenSections).toEqual(['projects']);
    expect(warnings.join(' ')).toContain('Unknown template');
    expect(warnings.join(' ')).toContain('not a hex value');
  });
});

describe('normalizeImportedResume — JSON Resume', () => {
  const { resume, warnings } = ok(normalizeImportedResume(JSON_RESUME));

  it('maps basics onto our contact block', () => {
    expect(resume.contact).toMatchObject({
      fullName: 'Ada Lovelace',
      headline: 'Analytical Engineer',
      email: 'ada@example.com',
      phone: '(512) 555-0100',
      location: 'Austin, TX',
      linkedin: 'linkedin.com/in/ada',
      github: 'github.com/ada',
    });
    expect(resume.summary).toContain('first published algorithm');
  });

  it('maps work into experience with summary and highlights as bullets', () => {
    expect(resume.experience).toHaveLength(2);
    expect(resume.experience[0]).toMatchObject({
      company: 'Analytical Engine Co',
      title: 'Lead Engineer',
      location: 'Austin, TX',
      startDate: '2019-03',
      endDate: '2023-07',
      current: false,
    });
    expect(resume.experience[0].bullets).toEqual([
      'Owned the compute roadmap.',
      'Shipped the first program, cutting calculation time 80%.',
    ]);
    // A missing endDate means the role is current.
    expect(resume.experience[1]).toMatchObject({ current: true, endDate: '', startDate: '2023-08' });
  });

  it('maps education, skills, projects and certificates', () => {
    expect(resume.education[0]).toMatchObject({
      school: 'University of Texas at Austin',
      degree: 'B.S.',
      field: 'Mathematics',
      gpa: '3.9',
      startDate: '2015-01',
      endDate: '2019-03',
    });
    expect(resume.education[0].details).toEqual(['Numerical analysis']);

    expect(resume.skillGroups[0]).toMatchObject({ name: 'Mathematics', skills: ['Algorithms', 'Analysis'] });
    expect(resume.skillGroups[1]).toMatchObject({ name: 'Skills', skills: ['Technical Writing'] });

    expect(resume.projects[0]).toMatchObject({ name: 'Note G', url: 'ada.example.com/noteg', technologies: ['Math'] });
    expect(resume.certifications[0]).toMatchObject({ name: 'Royal Society Fellow', issuer: 'Royal Society', date: '2020-05' });
  });

  it('keeps awards and volunteering as custom sections and warns about what it dropped', () => {
    expect(resume.customSections.map((section) => section.title)).toEqual(['Awards', 'Volunteer']);
    expect(resume.customSections[0].items[0]).toMatchObject({ heading: 'Gold Medal', subheading: 'Royal Society' });
    const joined = warnings.join(' ');
    expect(joined).toContain('Imported from JSON Resume format.');
    expect(joined).toContain('languages');
    expect(joined).toContain('interests');
  });

  it('gives every imported item a unique id', () => {
    const ids = [
      ...resume.experience.map((i) => i.id),
      ...resume.education.map((i) => i.id),
      ...resume.skillGroups.map((i) => i.id),
      ...resume.projects.map((i) => i.id),
      ...resume.certifications.map((i) => i.id),
      ...resume.customSections.map((i) => i.id),
      ...resume.customSections.flatMap((s) => s.items.map((i) => i.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('normalizeImportedResume — hopeless input', () => {
  it('rejects non-JSON text', () => {
    const result = normalizeImportedResume('this is not a resume, it is just prose');
    expect(result).toHaveProperty('error');
  });

  it('rejects empty and non-object values', () => {
    for (const input of ['', '   ', 42, null, undefined, true, [], [1, 2, 3]]) {
      expect(normalizeImportedResume(input)).toHaveProperty('error');
    }
  });

  it('rejects an object with no resume data in it', () => {
    const result = normalizeImportedResume({ foo: 'bar', nested: { deep: [1, 2] } });
    expect(result).toHaveProperty('error');
    if ('error' in result) expect(result.error).toContain('No resume data');
  });

  it('rejects an empty resumes export', () => {
    expect(normalizeImportedResume({ resumes: [] })).toHaveProperty('error');
  });

  it('never throws on adversarial input', () => {
    expect(() => normalizeImportedResume({ experience: [null, 5, 'x', { bullets: 7 }] })).not.toThrow();
    expect(() => normalizeImportedResume(JSON.stringify({ style: [] }))).not.toThrow();
  });
});
