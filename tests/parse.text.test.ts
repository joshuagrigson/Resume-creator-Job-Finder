import { describe, expect, it } from 'vitest';
import { findDateRange, parseResumeText, toYearMonth } from '@/lib/resume/parse-text';

const PASTED_RESUME = `Dana Whitfield
Senior Data Engineer
Austin, TX | dana.whitfield@example.com | (512) 555-0188
linkedin.com/in/danawhitfield | github.com/danaw | danawhitfield.dev

SUMMARY
Data engineer with 9 years building batch and streaming pipelines on AWS. Cut warehouse
spend 38% and shipped a self-serve analytics layer used by 200+ people.

PROFESSIONAL EXPERIENCE

Northwind Analytics — Austin, TX
Senior Data Engineer | Mar 2021 – Present
• Rebuilt the ingestion layer in Python and Airflow, cutting nightly runtime from 6h to 45m.
• Led a 5-engineer team migrating 400 TB from Redshift to Snowflake with zero downtime.
• Automated data quality checks that catch 92% of schema drift before it reaches dashboards.

Kestrel Software, Dallas, TX
Data Engineer   06/2018 - 02/2021
- Built streaming pipelines with Kafka and Spark processing 1.2B events per day.
- Designed dbt models that reduced report build time 55%.

Bluefin Labs | Analytics Engineer | 2015 - 2018
Developed ETL jobs in SQL and Python for a 40-person analytics organisation.
Maintained Looker dashboards used by sales leadership every single week.

EDUCATION
B.S. in Computer Science, University of Texas at Austin — 2011 - 2015
GPA: 3.8

TECHNICAL SKILLS
Languages: Python, SQL, Scala, Go
Cloud & Data: AWS, Snowflake, Airflow, dbt, Kafka, Spark, Terraform

CERTIFICATIONS
AWS Certified Data Analytics – Amazon Web Services – 2022
`;

describe('toYearMonth', () => {
  it('normalizes every common date shape to YYYY-MM', () => {
    expect(toYearMonth('Jan 2021')).toBe('2021-01');
    expect(toYearMonth('January 2021')).toBe('2021-01');
    expect(toYearMonth('Sept 2019')).toBe('2019-09');
    expect(toYearMonth('03/2019')).toBe('2019-03');
    expect(toYearMonth('3/15/2019')).toBe('2019-03');
    expect(toYearMonth('2021-03')).toBe('2021-03');
    expect(toYearMonth('2021-03-01')).toBe('2021-03');
  });

  it('uses January for a bare start year and December for a bare end year', () => {
    expect(toYearMonth('2019')).toBe('2019-01');
    expect(toYearMonth('2019', 'end')).toBe('2019-12');
  });

  it('returns an empty string for "Present" and unreadable input', () => {
    expect(toYearMonth('Present')).toBe('');
    expect(toYearMonth('current')).toBe('');
    expect(toYearMonth('')).toBe('');
    expect(toYearMonth('sometime soon')).toBe('');
  });
});

describe('findDateRange', () => {
  it('reads the date-range styles resumes actually use', () => {
    expect(findDateRange('Marketing Manager | Jan 2021 – Present')).toMatchObject({
      startDate: '2021-01',
      endDate: '',
      current: true,
    });
    expect(findDateRange('Analyst 2019-2021')).toMatchObject({ startDate: '2019-01', endDate: '2021-12', current: false });
    expect(findDateRange('Engineer 03/2019 - 05/2022')).toMatchObject({
      startDate: '2019-03',
      endDate: '2022-05',
      current: false,
    });
    expect(findDateRange('Lead, June 2017 to February 2021')).toMatchObject({
      startDate: '2017-06',
      endDate: '2021-02',
    });
  });

  it('returns null when there is no range', () => {
    expect(findDateRange('Reduced churn by 12% in the first quarter')).toBeNull();
    expect(findDateRange('')).toBeNull();
  });
});

describe('parseResumeText — contact block', () => {
  const parsed = parseResumeText(PASTED_RESUME);

  it('reads the name, headline, email, phone, location and links', () => {
    expect(parsed.contact).toMatchObject({
      fullName: 'Dana Whitfield',
      headline: 'Senior Data Engineer',
      email: 'dana.whitfield@example.com',
      phone: '(512) 555-0188',
      location: 'Austin, TX',
      linkedin: 'linkedin.com/in/danawhitfield',
      github: 'github.com/danaw',
      website: 'danawhitfield.dev',
    });
  });

  it('reads the summary paragraph', () => {
    expect(parsed.summary).toContain('Data engineer with 9 years');
    expect(parsed.summary).toContain('used by 200+ people.');
    expect(parsed.summary).not.toContain('\n');
  });
});

describe('parseResumeText — experience', () => {
  const parsed = parseResumeText(PASTED_RESUME);

  it('finds every role with its title, company, dates and bullets', () => {
    const experience = parsed.experience ?? [];
    expect(experience.length).toBeGreaterThanOrEqual(3);

    expect(experience[0]).toMatchObject({
      company: 'Northwind Analytics',
      title: 'Senior Data Engineer',
      location: 'Austin, TX',
      startDate: '2021-03',
      endDate: '',
      current: true,
    });
    expect(experience[0].bullets).toHaveLength(3);
    expect(experience[0].bullets[0]).toBe(
      'Rebuilt the ingestion layer in Python and Airflow, cutting nightly runtime from 6h to 45m.',
    );

    expect(experience[1]).toMatchObject({
      company: 'Kestrel Software',
      title: 'Data Engineer',
      location: 'Dallas, TX',
      startDate: '2018-06',
      endDate: '2021-02',
      current: false,
    });
    expect(experience[1].bullets).toHaveLength(2);

    expect(experience[2]).toMatchObject({
      company: 'Bluefin Labs',
      title: 'Analytics Engineer',
      startDate: '2015-01',
      endDate: '2018-12',
    });
    // Bullets written without a glyph are still picked up.
    expect(experience[2].bullets).toHaveLength(2);
    expect(experience[2].bullets[0]).toContain('Developed ETL jobs');
  });

  it('gives every parsed item a fresh unique id', () => {
    const ids = [
      ...(parsed.experience ?? []).map((i) => i.id),
      ...(parsed.education ?? []).map((i) => i.id),
      ...(parsed.skillGroups ?? []).map((i) => i.id),
      ...(parsed.certifications ?? []).map((i) => i.id),
    ];
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(parseResumeText(PASTED_RESUME).experience?.[0].id).not.toBe(parsed.experience?.[0].id);
  });

  it('handles the "Title at Company" style', () => {
    const parsedAt = parseResumeText(
      ['EXPERIENCE', 'Operations Manager at Ocean Canyon Resorts, Texarkana, TX (Mar 2021 - Present)', '• Booked 900 tours per month.'].join('\n'),
    );
    expect(parsedAt.experience?.[0]).toMatchObject({
      title: 'Operations Manager',
      company: 'Ocean Canyon Resorts',
      location: 'Texarkana, TX',
      startDate: '2021-03',
      current: true,
    });
  });
});

describe('parseResumeText — education, skills and certifications', () => {
  const parsed = parseResumeText(PASTED_RESUME);

  it('splits the degree, field, school, dates and GPA', () => {
    expect(parsed.education).toHaveLength(1);
    expect(parsed.education?.[0]).toMatchObject({
      degree: 'B.S.',
      field: 'Computer Science',
      school: 'University of Texas at Austin',
      startDate: '2011-01',
      endDate: '2015-12',
      gpa: '3.8',
    });
  });

  it('keeps labelled skill groups and splits on commas', () => {
    expect(parsed.skillGroups).toHaveLength(2);
    expect(parsed.skillGroups?.[0]).toMatchObject({ name: 'Languages', skills: ['Python', 'SQL', 'Scala', 'Go'] });
    expect(parsed.skillGroups?.[1].name).toBe('Cloud & Data');
    expect(parsed.skillGroups?.[1].skills).toContain('Terraform');
  });

  it('reads certifications with an issuer and a date', () => {
    expect(parsed.certifications).toHaveLength(1);
    expect(parsed.certifications?.[0]).toMatchObject({
      name: 'AWS Certified Data Analytics',
      issuer: 'Amazon Web Services',
      date: '2022',
    });
  });

  it('splits an unlabelled skills list into one group', () => {
    const skills = parseResumeText('SKILLS\nPython, SQL, Airflow\nSnowflake • dbt').skillGroups ?? [];
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('Skills');
    expect(skills[0].skills).toEqual(['Python', 'SQL', 'Airflow', 'Snowflake', 'dbt']);
  });
});

describe('parseResumeText — projects, custom sections and edge cases', () => {
  it('parses projects with a URL, description, bullets and technologies', () => {
    const parsed = parseResumeText(
      [
        'PROJECTS',
        'Agent Coaching Platform | coachingplatform.dev',
        'Internal app that transcribes calls and grades reps against a benchmark.',
        '• Cut QA review time per call from 25 minutes to 6.',
        'Technologies: JavaScript, Cloudflare Pages, Whisper',
      ].join('\n'),
    );
    expect(parsed.projects?.[0]).toMatchObject({
      name: 'Agent Coaching Platform',
      url: 'coachingplatform.dev',
      technologies: ['JavaScript', 'Cloudflare Pages', 'Whisper'],
    });
    expect(parsed.projects?.[0].description).toContain('transcribes calls');
    expect(parsed.projects?.[0].bullets).toHaveLength(1);
  });

  it('turns unknown headings into custom sections', () => {
    const parsed = parseResumeText('AWARDS\nPresident’s Club 2023\nTop performer 2022');
    expect(parsed.customSections?.[0].title).toBe('Awards');
    expect(parsed.customSections?.[0].items[0].bullets).toEqual(['President’s Club 2023', 'Top performer 2022']);
  });

  it('handles a resume with no headings at all', () => {
    const parsed = parseResumeText(
      [
        'Sam Rivera',
        'sam@example.com',
        'Warehouse Supervisor, Gulf Freight — Jan 2020 - Present',
        'Supervised 22 associates across two shifts, lifting on-time dispatch to 98%.',
      ].join('\n'),
    );
    expect(parsed.contact?.fullName).toBe('Sam Rivera');
    expect(parsed.experience?.[0]).toMatchObject({ title: 'Warehouse Supervisor', current: true });
    expect(parsed.experience?.[0].bullets[0]).toContain('Supervised 22 associates');
  });

  it('returns an empty object for empty or whitespace input', () => {
    expect(parseResumeText('')).toEqual({});
    expect(parseResumeText('   \n\n  ')).toEqual({});
  });

  it('never throws on noisy input', () => {
    expect(() => parseResumeText('•••\n---\n@@@\n1234567890\n' + '#'.repeat(500))).not.toThrow();
  });

  it('treats indented lines as bullets even when the whole document is indented', () => {
    const parsed = parseResumeText(
      [
        '    EXPERIENCE',
        '    Acme Co',
        '    Operations Manager   Jan 2020 - Dec 2022',
        '        Reduced cost per order 14% by renegotiating three carrier contracts.',
      ].join('\n'),
    );
    expect(parsed.experience?.[0].bullets).toEqual([
      'Reduced cost per order 14% by renegotiating three carrier contracts.',
    ]);
  });
});
