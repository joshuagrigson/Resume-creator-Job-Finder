import { describe, expect, it } from 'vitest';
import type { Resume, SectionKey } from '@shared/types';
import { createCustomSection, createSampleResume } from '@/lib/resume/defaults';
import { cleanList, displayUrl, formatMonth, formatPhone, formatRange, joinParts, linkHref } from '@/lib/resume/format';
import { contactEntries, contactLine, resumeSections, sectionItems } from '@/lib/export/format';
import { hexForDocx, normalizeHex, readableOnPaper, shade, tint } from '@/lib/export/color';
import { resumeFileName } from '@/lib/export/file';

describe('formatMonth', () => {
  it('turns a YYYY-MM string into a short month + year', () => {
    expect(formatMonth('2021-03')).toBe('Mar 2021');
    expect(formatMonth('2021-01')).toBe('Jan 2021');
    expect(formatMonth('2021-12')).toBe('Dec 2021');
    expect(formatMonth('2021-3')).toBe('Mar 2021');
    expect(formatMonth('2021-03-14')).toBe('Mar 2021');
  });

  it('supports long month names', () => {
    expect(formatMonth('2021-03', 'long')).toBe('March 2021');
  });

  it('leaves years, free text and empties alone', () => {
    expect(formatMonth('2021')).toBe('2021');
    expect(formatMonth('Summer 2020')).toBe('Summer 2020');
    expect(formatMonth('')).toBe('');
    expect(formatMonth(undefined)).toBe('');
    expect(formatMonth('  2019-07  ')).toBe('Jul 2019');
  });

  it('does not invent a month for an out-of-range number', () => {
    expect(formatMonth('2021-13')).toBe('2021');
    expect(formatMonth('2021-00')).toBe('2021');
  });
});

describe('formatRange', () => {
  it('renders a closed range with an en dash', () => {
    expect(formatRange('2017-06', '2021-02', false)).toBe('Jun 2017 – Feb 2021');
  });

  it('renders "Present" for a current role and ignores any end date', () => {
    expect(formatRange('2021-03', '', true)).toBe('Mar 2021 – Present');
    expect(formatRange('2021-03', '2022-01', true)).toBe('Mar 2021 – Present');
  });

  it('degrades to whichever half exists', () => {
    expect(formatRange('2021-03', '', false)).toBe('Mar 2021');
    expect(formatRange('', '2021-03', false)).toBe('Mar 2021');
    expect(formatRange('', '', false)).toBe('');
  });
});

describe('displayUrl / linkHref', () => {
  it('strips the protocol and any trailing slash', () => {
    expect(displayUrl('https://jordanrivera.dev/')).toBe('jordanrivera.dev');
    expect(displayUrl('http://example.com')).toBe('example.com');
    expect(displayUrl('https://linkedin.com/in/jordanrivera/')).toBe('linkedin.com/in/jordanrivera');
    expect(displayUrl('jordanrivera.dev')).toBe('jordanrivera.dev');
    expect(displayUrl('mailto:a@b.com')).toBe('a@b.com');
    expect(displayUrl('')).toBe('');
    expect(displayUrl(undefined)).toBe('');
  });

  it('keeps the path but not the trailing slashes', () => {
    expect(displayUrl('https://github.com/jrivera///')).toBe('github.com/jrivera');
  });

  it('builds an absolute href from a bare domain', () => {
    expect(linkHref('jordanrivera.dev')).toBe('https://jordanrivera.dev');
    expect(linkHref('https://jordanrivera.dev')).toBe('https://jordanrivera.dev');
    expect(linkHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(linkHref('')).toBe('');
  });
});

describe('formatPhone', () => {
  it('formats bare US numbers', () => {
    expect(formatPhone('9035550142')).toBe('(903) 555-0142');
    expect(formatPhone('19035550142')).toBe('+1 (903) 555-0142');
  });

  it('leaves already-formatted and international numbers alone', () => {
    expect(formatPhone('(903) 555-0142')).toBe('(903) 555-0142');
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(formatPhone('903.555.0142 ext 12')).toBe('903.555.0142 ext 12');
    expect(formatPhone('')).toBe('');
  });
});

describe('joinParts / cleanList', () => {
  it('drops empty pieces', () => {
    expect(joinParts(['Austin, TX', '', undefined, 'Remote'])).toBe('Austin, TX · Remote');
    expect(joinParts([], ' — ')).toBe('');
    expect(cleanList(['  a  ', '', '  ', 'b\n c'])).toEqual(['a', 'b c']);
    expect(cleanList(undefined)).toEqual([]);
  });
});

describe('contactEntries', () => {
  it('orders the contact line and never shows a protocol', () => {
    const resume = createSampleResume();
    const entries = contactEntries(resume.contact);
    expect(entries.map((entry) => entry.id)).toEqual(['location', 'phone', 'email', 'linkedin', 'website']);
    expect(entries.every((entry) => !entry.text.includes('https://'))).toBe(true);
    expect(entries.find((entry) => entry.id === 'email')?.href).toBe('mailto:jordan.rivera@example.com');
    expect(contactLine(resume.contact)).toContain('Texarkana, TX · (903) 555-0142');
  });

  it('handles a completely empty contact block', () => {
    expect(contactEntries(undefined)).toEqual([]);
    expect(contactLine(undefined)).toBe('');
  });
});

describe('resumeSections', () => {
  it('honours order, hidden sections and emptiness', () => {
    const resume = createSampleResume();
    resume.style = {
      ...resume.style,
      sectionOrder: ['experience', 'summary', 'skills', 'education', 'projects', 'certifications'],
      hiddenSections: ['education'],
    };
    resume.projects = [];

    expect(resumeSections(resume).map((section) => section.key)).toEqual([
      'experience',
      'summary',
      'skills',
      'certifications',
    ]);
  });

  it('includes custom sections with their own title', () => {
    const custom = createCustomSection({
      title: 'Volunteering',
      items: [{ id: 'i1', heading: 'Food bank', subheading: 'Coordinator', date: '2022', bullets: [] }],
    });
    const resume: Resume = {
      ...createSampleResume(),
      customSections: [custom],
    };
    resume.style = { ...resume.style, sectionOrder: ['summary', `custom:${custom.id}` as SectionKey] };

    const sections = resumeSections(resume);
    const found = sections.find((section) => section.kind === 'custom');
    expect(found?.title).toBe('Volunteering');
    expect(sectionItems(resume, found!)).toHaveLength(1);
  });

  it('drops a custom section whose items are all blank', () => {
    const custom = createCustomSection({
      title: 'Empty',
      items: [{ id: 'i1', heading: '  ', subheading: '', date: '', bullets: ['   '] }],
    });
    const resume: Resume = { ...createSampleResume(), customSections: [custom] };
    expect(resumeSections(resume).some((section) => section.kind === 'custom')).toBe(false);
  });

  it('drops experience rows that are entirely blank', () => {
    const resume = createSampleResume();
    resume.experience = [
      ...resume.experience,
      { id: 'blank', company: '', title: '', location: '', startDate: '', endDate: '', current: false, bullets: [''] },
    ];
    const experience = resumeSections(resume).find((section) => section.kind === 'experience')!;
    expect(sectionItems(resume, experience)).toHaveLength(2);
  });
});

describe('colour helpers', () => {
  it('normalises hex input', () => {
    expect(normalizeHex('#1F5EFF')).toBe('#1f5eff');
    expect(normalizeHex('1f5eff')).toBe('#1f5eff');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('rebeccapurple')).toBe('#1f5eff');
    expect(normalizeHex(undefined)).toBe('#1f5eff');
    expect(hexForDocx('#0d8342')).toBe('0D8342');
  });

  it('tints toward white and shades toward black', () => {
    expect(tint('#000000', 0)).toBe('#ffffff');
    expect(tint('#000000', 1)).toBe('#000000');
    expect(shade('#ffffff', 1)).toBe('#000000');
    expect(shade('#ffffff', 0)).toBe('#ffffff');
  });

  it('darkens a pale accent until it can be read on paper', () => {
    expect(readableOnPaper('#1f5eff')).toBe('#1f5eff');
    const readable = readableOnPaper('#ffe066');
    expect(readable).not.toBe('#ffe066');
    expect(readable.startsWith('#')).toBe(true);
  });
});

describe('resumeFileName', () => {
  const base = createSampleResume();

  it('uses the person name', () => {
    expect(resumeFileName(base, 'pdf')).toBe('Jordan Rivera Resume.pdf');
    expect(resumeFileName(base, '.docx')).toBe('Jordan Rivera Resume.docx');
    expect(resumeFileName(base)).toBe('Jordan Rivera Resume');
  });

  it('strips characters that are illegal in a file name', () => {
    const resume: Resume = { ...base, contact: { ...base.contact, fullName: 'Jordan/Rivera:*?"<>|\\Jr' } };
    expect(resumeFileName(resume, 'pdf')).toBe('Jordan Rivera Jr Resume.pdf');
  });

  it('keeps hyphens, apostrophes and accents', () => {
    const resume: Resume = { ...base, contact: { ...base.contact, fullName: "Ana-María O'Brien" } };
    expect(resumeFileName(resume, 'json')).toBe("Ana-María O'Brien Resume.json");
  });

  it('falls back to the resume label, then to "Resume"', () => {
    const noName: Resume = { ...base, name: 'Marketing Ops', contact: { ...base.contact, fullName: '   ' } };
    expect(resumeFileName(noName, 'pdf')).toBe('Marketing Ops Resume.pdf');

    const nothing: Resume = { ...base, name: '', contact: { ...base.contact, fullName: '' } };
    expect(resumeFileName(nothing, 'pdf')).toBe('Resume.pdf');
  });

  it('does not say "Resume Resume"', () => {
    const resume: Resume = { ...base, name: 'Backend resume', contact: { ...base.contact, fullName: '' } };
    expect(resumeFileName(resume, 'pdf')).toBe('Backend resume.pdf');
  });

  it('trims leading dots so the file is never hidden', () => {
    const resume: Resume = { ...base, contact: { ...base.contact, fullName: '...jordan' } };
    expect(resumeFileName(resume, 'pdf')).toBe('jordan Resume.pdf');
  });
});
