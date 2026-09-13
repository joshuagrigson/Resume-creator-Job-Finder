import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Resume, SectionKey } from '@shared/types';
import { createCustomSection, createSampleResume } from '@/lib/resume/defaults';
import { buildResumeDocument, resumeDocxBlob } from '@/lib/export/docx';

// ---------------------------------------------------------------------------
// A tiny, dependency-free zip reader so we can assert on the real .docx contents.
// Walks the central directory (docx entries may carry data descriptors, so the
// local headers alone are not trustworthy for sizes).
// ---------------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

function readZip(buffer: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip archive: no end-of-central-directory record.');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));

    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function docxParts(resume: Resume): Promise<{ blob: Blob; files: Map<string, Buffer>; xml: string }> {
  const blob = await resumeDocxBlob(resume);
  const files = readZip(Buffer.from(await blob.arrayBuffer()));
  const document = files.get('word/document.xml');
  if (!document) throw new Error('word/document.xml missing from the export.');
  return { blob, files, xml: document.toString('utf8') };
}

function sampleWithCustomSection(): Resume {
  const resume = createSampleResume();
  const custom = createCustomSection({
    title: 'Speaking',
    items: [
      {
        id: 'talk-1',
        heading: 'Call Center Summit',
        subheading: 'Panelist',
        date: '2024-05',
        bullets: ['Ran a session on benchmark-call coaching for 120 attendees.'],
      },
    ],
  });
  return {
    ...resume,
    customSections: [custom],
    style: {
      ...resume.style,
      sectionOrder: [...resume.style.sectionOrder, `custom:${custom.id}` as SectionKey],
    },
  };
}

describe('exportDocx', () => {
  it('packs a real .docx of a sensible size', async () => {
    const blob = await resumeDocxBlob(createSampleResume());
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(5 * 1024);
  });

  it('builds a Document that can be inspected without packing', () => {
    const document = buildResumeDocument(createSampleResume());
    expect(document).toBeTruthy();
    expect(typeof document).toBe('object');
  });

  it('contains the OOXML parts Word needs', async () => {
    const { files } = await docxParts(createSampleResume());
    expect(files.has('word/document.xml')).toBe(true);
    expect(files.has('word/styles.xml')).toBe(true);
    expect(files.has('word/numbering.xml')).toBe(true);
    expect(files.has('[Content_Types].xml')).toBe(true);
  });

  it('writes the header: name, headline and a single contact line', async () => {
    const { xml } = await docxParts(createSampleResume());
    expect(xml).toContain('Jordan Rivera');
    expect(xml).toContain('Marketing Operations Manager');
    expect(xml).toContain('Texarkana, TX · (903) 555-0142 · jordan.rivera@example.com');
    // Links are plain text in the Word file — no protocols for a parser to trip on.
    expect(xml).not.toContain('https://');
  });

  it('mirrors sectionOrder, skips hidden sections and includes custom ones', async () => {
    const resume = sampleWithCustomSection();
    resume.style = {
      ...resume.style,
      sectionOrder: ['summary', 'experience', 'skills', 'education', 'projects', 'certifications', ...resume.style.sectionOrder.filter((key) => key.startsWith('custom:'))],
      hiddenSections: ['certifications'],
    };

    const { xml } = await docxParts(resume);

    const order = ['SUMMARY', 'EXPERIENCE', 'SKILLS', 'EDUCATION', 'PROJECTS', 'SPEAKING'];
    const positions = order.map((heading) => xml.indexOf(heading));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    expect(xml).not.toContain('CERTIFICATIONS');
    expect(xml).toContain('Call Center Summit');
  });

  it('writes roles, right-aligned dates, italic locations and real bullets', async () => {
    const { xml } = await docxParts(createSampleResume());

    expect(xml).toContain('Marketing Operations Manager — Ocean Canyon Resorts');
    expect(xml).toContain('Mar 2021 – Present');
    expect(xml).toContain('Jun 2017 – Feb 2021');
    // Right tab stop for the date column.
    expect(xml).toContain('w:val="right"');
    // Real list numbering, not a "•" typed into the text.
    expect(xml).toContain('<w:numPr>');
    expect(xml).toContain('Built HubSpot + Twilio automations');
  });

  it('writes skills as "Group: a, b, c" lines', async () => {
    const { xml } = await docxParts(createSampleResume());
    expect(xml).toContain('Tools: ');
    expect(xml).toContain('HubSpot, Salesforce, Twilio, Convoso, GoHighLevel, Google Analytics, Excel, SQL');
  });

  it('writes education and certifications', async () => {
    const resume = createSampleResume();
    const { xml } = await docxParts(resume);
    expect(xml).toContain('Texas A&amp;M University–Texarkana');
    expect(xml).toContain('B.B.A., Marketing');
    expect(xml).toContain('GPA 3.7');
    expect(xml).toContain('HubSpot Marketing Software — HubSpot Academy');
    expect(xml).toContain('Apr 2022');
  });

  it('uses Calibri for sans and Georgia for serif', async () => {
    const sans = await docxParts(createSampleResume());
    expect(sans.files.get('word/styles.xml')?.toString('utf8')).toContain('Calibri');

    const serifResume = createSampleResume();
    serifResume.style = { ...serifResume.style, font: 'serif' };
    const serif = await docxParts(serifResume);
    expect(serif.files.get('word/styles.xml')?.toString('utf8')).toContain('Georgia');
  });

  it('applies the page size and 0.7in margins', async () => {
    const letter = await docxParts(createSampleResume());
    expect(letter.xml).toContain('w:w="12240"');
    expect(letter.xml).toContain('w:h="15840"');
    expect(letter.xml).toContain('w:top="1008"');

    const a4Resume = createSampleResume();
    a4Resume.style = { ...a4Resume.style, pageSize: 'a4' };
    const a4 = await docxParts(a4Resume);
    expect(a4.xml).toContain('w:w="11905"');
    expect(a4.xml).toContain('w:h="16837"');
  });

  it('colours the section rules with the accent', async () => {
    const resume = createSampleResume();
    resume.style = { ...resume.style, accentColor: '#0d8342' };
    const { xml } = await docxParts(resume);
    expect(xml).toContain('0D8342');
  });

  it('survives a resume with nothing in it', async () => {
    const empty: Resume = {
      ...createSampleResume(),
      summary: '',
      experience: [],
      education: [],
      skillGroups: [],
      projects: [],
      certifications: [],
      customSections: [],
    };
    const blob = await resumeDocxBlob(empty);
    expect(blob.size).toBeGreaterThan(1024);
  });
});
