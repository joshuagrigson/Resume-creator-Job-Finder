/**
 * DOCX export.
 *
 * Deliberately plainer than the on-screen templates: one column, no text boxes, no tables, real
 * bullet numbering and real headings. That is what applicant tracking systems parse reliably,
 * and a recruiter can still edit it. The *content* — section order, hidden sections, custom
 * sections — mirrors the preview exactly, because both read `resumeSections()`.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  convertInchesToTwip,
  convertMillimetersToTwip,
  type IParagraphOptions,
  type ISectionOptions,
} from 'docx';
import type {
  CertificationItem,
  CustomSectionItem,
  EducationItem,
  ExperienceItem,
  PageSize,
  ProjectItem,
  Resume,
  SkillGroup,
} from '@shared/types';
import { hexForDocx } from './color';
import { downloadBlob, resumeFileName } from './file';
import {
  certificationDate,
  certificationLine,
  cleanList,
  contactLine,
  displayUrl,
  educationDates,
  educationDegreeLine,
  educationMeta,
  experienceDates,
  joinParts,
  projectMeta,
  resumeSections,
  sectionItems,
  type ResumeSection,
} from './format';

const BULLET_REFERENCE = 'resume-bullets';

/** 1pt = 20 twips. */
const PT = 20;

const PAGE_TWIPS: Record<PageSize, { width: number; height: number }> = {
  letter: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
  a4: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
};

const MARGIN_TWIPS = convertInchesToTwip(0.7);

interface DocxTheme {
  /** Half-points (docx's unit for font size). */
  body: number;
  name: number;
  headline: number;
  heading: number;
  small: number;
  bodyFont: string;
  headingFont: string;
  accent: string;
  contentWidth: number;
}

function buildTheme(resume: Resume): DocxTheme {
  const raw = Number(resume.style?.fontSize);
  const points = Number.isFinite(raw) ? Math.min(12, Math.max(9, raw)) : 10.5;
  const half = (multiplier: number) => Math.round(points * 2 * multiplier);

  const serif = resume.style?.font === 'serif';
  const mixed = resume.style?.font === 'mixed';
  const bodyFont = serif ? 'Georgia' : 'Calibri';
  const headingFont = serif || mixed ? 'Georgia' : 'Calibri';

  const pageSize: PageSize = resume.style?.pageSize === 'a4' ? 'a4' : 'letter';

  return {
    body: half(1),
    name: half(2),
    headline: half(1.15),
    heading: half(1.02),
    small: half(0.9),
    bodyFont,
    headingFont,
    accent: hexForDocx(resume.style?.accentColor),
    contentWidth: PAGE_TWIPS[pageSize].width - MARGIN_TWIPS * 2,
  };
}

// ---------------------------------------------------------------------------
// Paragraph helpers
// ---------------------------------------------------------------------------

function textParagraph(text: string, theme: DocxTheme, options: Partial<IParagraphOptions> = {}, runOptions: {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
} = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 2 * PT },
    ...options,
    children: [
      new TextRun({
        text,
        font: theme.bodyFont,
        size: runOptions.size ?? theme.body,
        bold: runOptions.bold,
        italics: runOptions.italics,
        color: runOptions.color,
      }),
    ],
  });
}

/** "Left thing (bold)" … right-aligned date on the same line, via a right tab stop. */
function twoColumnLine(
  left: string,
  right: string,
  theme: DocxTheme,
  options: { bold?: boolean; italics?: boolean; size?: number; rightItalics?: boolean } = {},
): Paragraph {
  const children = [
    new TextRun({
      text: left,
      font: theme.bodyFont,
      size: options.size ?? theme.body,
      bold: options.bold,
      italics: options.italics,
    }),
  ];
  if (right) {
    children.push(
      new TextRun({
        text: `\t${right}`,
        font: theme.bodyFont,
        size: options.size ?? theme.small,
        italics: options.rightItalics,
      }),
    );
  }
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: theme.contentWidth }],
    spacing: { after: 1 * PT },
    children,
  });
}

function sectionHeading(title: string, theme: DocxTheme): Paragraph {
  return new Paragraph({
    spacing: { before: 10 * PT, after: 4 * PT },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: theme.accent },
    },
    keepNext: true,
    children: [
      new TextRun({
        text: title.toUpperCase(),
        font: theme.headingFont,
        size: theme.heading,
        bold: true,
        color: theme.accent,
        characterSpacing: 12,
      }),
    ],
  });
}

function bulletParagraphs(bullets: readonly string[] | undefined, theme: DocxTheme): Paragraph[] {
  return cleanList(bullets).map(
    (bullet) =>
      new Paragraph({
        numbering: { reference: BULLET_REFERENCE, level: 0 },
        spacing: { after: 1 * PT },
        children: [new TextRun({ text: bullet, font: theme.bodyFont, size: theme.body })],
      }),
  );
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function experienceParagraphs(items: ExperienceItem[], theme: DocxTheme): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    const title = (item.title ?? '').trim();
    const company = (item.company ?? '').trim();
    const heading = joinParts([title, company], ' — ') || company || title;
    out.push(twoColumnLine(heading, experienceDates(item), theme, { bold: true }));

    const location = (item.location ?? '').trim();
    if (location) {
      out.push(textParagraph(location, theme, { spacing: { after: 1 * PT } }, { italics: true, size: theme.small }));
    }
    out.push(...bulletParagraphs(item.bullets, theme));
    out.push(new Paragraph({ spacing: { after: 3 * PT }, children: [] }));
  }
  out.pop();
  return out;
}

function educationParagraphs(items: EducationItem[], theme: DocxTheme): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    const school = (item.school ?? '').trim();
    out.push(twoColumnLine(school || educationDegreeLine(item), educationDates(item), theme, { bold: true }));

    const degree = school ? educationDegreeLine(item) : '';
    const meta = educationMeta(item);
    const second = joinParts([degree, meta]);
    if (second) {
      out.push(textParagraph(second, theme, { spacing: { after: 1 * PT } }, { italics: true, size: theme.small }));
    }
    out.push(...bulletParagraphs(item.details, theme));
  }
  return out;
}

function skillsParagraphs(groups: SkillGroup[], theme: DocxTheme): Paragraph[] {
  return groups.map((group) => {
    const name = (group.name ?? '').trim();
    const values = cleanList(group.skills).join(', ');
    const children: TextRun[] = [];
    if (name) {
      children.push(new TextRun({ text: `${name}: `, font: theme.bodyFont, size: theme.body, bold: true }));
    }
    children.push(new TextRun({ text: values, font: theme.bodyFont, size: theme.body }));
    return new Paragraph({ spacing: { after: 2 * PT }, children });
  });
}

function projectParagraphs(items: ProjectItem[], theme: DocxTheme): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    const name = (item.name ?? '').trim();
    out.push(twoColumnLine(name, displayUrl(item.url), theme, { bold: true }));

    const description = (item.description ?? '').trim();
    if (description) out.push(textParagraph(description, theme, { spacing: { after: 1 * PT } }));

    out.push(...bulletParagraphs(item.bullets, theme));

    const tech = projectMeta(item);
    if (tech) {
      out.push(
        textParagraph(`Tech: ${tech}`, theme, { spacing: { after: 3 * PT } }, { italics: true, size: theme.small }),
      );
    }
  }
  return out;
}

function certificationParagraphs(items: CertificationItem[], theme: DocxTheme): Paragraph[] {
  return items.map((item) => twoColumnLine(certificationLine(item), certificationDate(item), theme));
}

function customParagraphs(items: CustomSectionItem[], theme: DocxTheme): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of items) {
    const heading = (item.heading ?? '').trim();
    const date = (item.date ?? '').trim();
    if (heading || date) out.push(twoColumnLine(heading, date, theme, { bold: true }));

    const subheading = (item.subheading ?? '').trim();
    if (subheading) {
      out.push(textParagraph(subheading, theme, { spacing: { after: 1 * PT } }, { italics: true, size: theme.small }));
    }
    out.push(...bulletParagraphs(item.bullets, theme));
  }
  return out;
}

function sectionParagraphs(resume: Resume, section: ResumeSection, theme: DocxTheme): Paragraph[] {
  switch (section.kind) {
    case 'summary':
      return [textParagraph((resume.summary ?? '').trim(), theme)];
    case 'experience':
      return experienceParagraphs(sectionItems(resume, section) as ExperienceItem[], theme);
    case 'education':
      return educationParagraphs(sectionItems(resume, section) as EducationItem[], theme);
    case 'skills':
      return skillsParagraphs(sectionItems(resume, section) as SkillGroup[], theme);
    case 'projects':
      return projectParagraphs(sectionItems(resume, section) as ProjectItem[], theme);
    case 'certifications':
      return certificationParagraphs(sectionItems(resume, section) as CertificationItem[], theme);
    case 'custom':
      return customParagraphs(sectionItems(resume, section) as CustomSectionItem[], theme);
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

function headerParagraphs(resume: Resume, theme: DocxTheme): Paragraph[] {
  const out: Paragraph[] = [];
  const name = (resume.contact?.fullName ?? '').trim();
  const headline = (resume.contact?.headline ?? '').trim();
  const contact = contactLine(resume.contact);

  if (name) {
    out.push(
      new Paragraph({
        spacing: { after: 1 * PT },
        keepNext: true,
        children: [
          new TextRun({ text: name, font: theme.headingFont, size: theme.name, bold: true, characterSpacing: 4 }),
        ],
      }),
    );
  }
  if (headline) {
    out.push(
      new Paragraph({
        spacing: { after: 2 * PT },
        keepNext: true,
        children: [
          new TextRun({ text: headline, font: theme.bodyFont, size: theme.headline, color: theme.accent, bold: true }),
        ],
      }),
    );
  }
  if (contact) {
    out.push(
      new Paragraph({
        spacing: { after: 2 * PT },
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: contact, font: theme.bodyFont, size: theme.small })],
      }),
    );
  }
  return out;
}

/**
 * Builds the `docx` Document. Exported (rather than only the download wrapper) so it can be
 * packed and asserted on in node.
 */
export function buildResumeDocument(resume: Resume): Document {
  const theme = buildTheme(resume);
  const pageSize: PageSize = resume.style?.pageSize === 'a4' ? 'a4' : 'letter';
  const page = PAGE_TWIPS[pageSize];

  const children: Paragraph[] = [...headerParagraphs(resume, theme)];
  for (const section of resumeSections(resume)) {
    const body = sectionParagraphs(resume, section, theme);
    if (body.length === 0) continue;
    children.push(sectionHeading(section.title, theme));
    children.push(...body);
  }

  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: page.width, height: page.height },
        margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
      },
    },
    children,
  };

  return new Document({
    creator: 'Launchpad',
    title: resumeFileName(resume, ''),
    description: 'Resume exported from Launchpad',
    styles: {
      default: {
        document: {
          run: { font: theme.bodyFont, size: theme.body, color: '1A1A1A' },
          paragraph: { spacing: { line: 264, lineRule: 'auto' } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: BULLET_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.16) },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [section],
  });
}

/** The packed .docx bytes. */
export async function resumeDocxBlob(resume: Resume): Promise<Blob> {
  return Packer.toBlob(buildResumeDocument(resume));
}

/** Downloads `"<Name> Resume.docx"`. */
export async function exportDocx(resume: Resume): Promise<void> {
  const blob = await resumeDocxBlob(resume);
  downloadBlob(blob, resumeFileName(resume, 'docx'));
}
