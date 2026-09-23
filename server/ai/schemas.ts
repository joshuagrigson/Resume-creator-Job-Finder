/**
 * Request validation (zod v4) and the size caps from docs/SPEC.md.
 *
 * The resume schemas are deliberately forgiving: unknown keys are stripped and every field has a
 * default, so an older persisted resume can still be sent to an AI endpoint. What we never do is
 * trust the size of the payload — caps are enforced against the raw body before parsing.
 */
import { z, type ZodType } from 'zod';
import { badRequestError } from './errors';

export const SIZE_CAPS = {
  /** A single résumé bullet. */
  bullet: 1024,
  /** Pasted job description. */
  jobText: 20 * 1024,
  /** Serialized resume object. */
  resume: 200 * 1024,
  /** Pasted resume text for parsing. */
  text: 40 * 1024,
  /** One field sent to Polish (a summary is the longest). */
  polish: 4 * 1024,
} as const;

const optionalText = z.string().default('');
const textList = z.array(z.string()).default([]);

const ContactSchema = z
  .object({
    fullName: optionalText,
    headline: optionalText,
    email: optionalText,
    phone: optionalText,
    location: optionalText,
    website: optionalText,
    linkedin: optionalText,
    github: optionalText,
  })
  .prefault({});

const ExperienceSchema = z
  .array(
    z.object({
      id: optionalText,
      company: optionalText,
      title: optionalText,
      location: optionalText,
      startDate: optionalText,
      endDate: optionalText,
      current: z.boolean().default(false),
      bullets: textList,
    }),
  )
  .default([]);

const EducationSchema = z
  .array(
    z.object({
      id: optionalText,
      school: optionalText,
      degree: optionalText,
      field: optionalText,
      location: optionalText,
      startDate: optionalText,
      endDate: optionalText,
      gpa: optionalText,
      details: textList,
    }),
  )
  .default([]);

const SkillGroupsSchema = z
  .array(z.object({ id: optionalText, name: optionalText, skills: textList }))
  .default([]);

const ProjectsSchema = z
  .array(
    z.object({
      id: optionalText,
      name: optionalText,
      url: optionalText,
      description: optionalText,
      bullets: textList,
      technologies: textList,
    }),
  )
  .default([]);

const CertificationsSchema = z
  .array(z.object({ id: optionalText, name: optionalText, issuer: optionalText, date: optionalText, url: optionalText }))
  .default([]);

const CustomSectionsSchema = z
  .array(
    z.object({
      id: optionalText,
      title: optionalText,
      items: z
        .array(
          z.object({
            id: optionalText,
            heading: optionalText,
            subheading: optionalText,
            date: optionalText,
            bullets: textList,
          }),
        )
        .default([]),
    }),
  )
  .default([]);

/** The parts of a Resume the AI prompts care about. Extra keys (id, style, …) are ignored. */
export const ResumeInputSchema = z.object({
  contact: ContactSchema,
  summary: optionalText,
  experience: ExperienceSchema,
  education: EducationSchema,
  skillGroups: SkillGroupsSchema,
  projects: ProjectsSchema,
  certifications: CertificationsSchema,
  customSections: CustomSectionsSchema,
});

export type ResumeInput = z.infer<typeof ResumeInputSchema>;
export type ExperienceInput = ResumeInput['experience'][number];

const jobText = z.string().max(SIZE_CAPS.jobText * 4);

export const ImproveBulletRequestSchema = z.object({
  bullet: z.string().trim().min(3, 'Bullet is too short to improve.').max(SIZE_CAPS.bullet * 4),
  role: z.string().max(200).optional(),
  jobText: jobText.optional(),
  tone: z.enum(['concise', 'impact', 'leadership', 'technical']).optional(),
});

export const SummaryRequestSchema = z.object({
  resume: ResumeInputSchema,
  jobText: jobText.optional(),
});

export const TailorRequestSchema = z.object({
  resume: ResumeInputSchema,
  jobText: jobText.min(40, 'Paste more of the job description (at least 40 characters).'),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
});

export const CoverLetterRequestSchema = z.object({
  resume: ResumeInputSchema,
  jobText: jobText.min(40, 'Paste more of the job description (at least 40 characters).'),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  tone: z.enum(['professional', 'warm', 'direct']).optional(),
  lengthWords: z.number().int().min(120).max(400).optional(),
});

export const ParseResumeRequestSchema = z.object({
  text: z.string().trim().min(40, 'Paste more resume text (at least 40 characters).').max(SIZE_CAPS.text * 4),
});

export const PolishRequestSchema = z.object({
  text: z.string().trim().min(3, 'Type a few words first.').max(SIZE_CAPS.polish * 4),
  kind: z.enum(['summary', 'bullet', 'description']),
  role: z.string().max(200).optional(),
  answers: z
    .array(z.object({ question: z.string().max(300), answer: z.string().trim().max(300) }))
    .max(4)
    .optional(),
});

export type ImproveBulletInput = z.infer<typeof ImproveBulletRequestSchema>;
export type SummaryInput = z.infer<typeof SummaryRequestSchema>;
export type TailorInput = z.infer<typeof TailorRequestSchema>;
export type CoverLetterInput = z.infer<typeof CoverLetterRequestSchema>;
export type ParseResumeInput = z.infer<typeof ParseResumeRequestSchema>;
export type PolishInput = z.infer<typeof PolishRequestSchema>;

export interface SizeCap {
  field: string;
  maxBytes: number;
  label: string;
}

export const REQUEST_CAPS = {
  improveBullet: [
    { field: 'bullet', maxBytes: SIZE_CAPS.bullet, label: 'bullet' },
    { field: 'jobText', maxBytes: SIZE_CAPS.jobText, label: 'job description' },
  ],
  summary: [
    { field: 'resume', maxBytes: SIZE_CAPS.resume, label: 'resume' },
    { field: 'jobText', maxBytes: SIZE_CAPS.jobText, label: 'job description' },
  ],
  tailor: [
    { field: 'resume', maxBytes: SIZE_CAPS.resume, label: 'resume' },
    { field: 'jobText', maxBytes: SIZE_CAPS.jobText, label: 'job description' },
  ],
  coverLetter: [
    { field: 'resume', maxBytes: SIZE_CAPS.resume, label: 'resume' },
    { field: 'jobText', maxBytes: SIZE_CAPS.jobText, label: 'job description' },
  ],
  parseResume: [{ field: 'text', maxBytes: SIZE_CAPS.text, label: 'resume text' }],
  polish: [
    { field: 'text', maxBytes: SIZE_CAPS.polish, label: 'text' },
    { field: 'answers', maxBytes: 2 * 1024, label: 'answers' },
  ],
} satisfies Record<string, SizeCap[]>;

function byteSize(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
  } catch {
    // Circular or otherwise unserializable input is rejected by the zod pass below.
    return 0;
  }
}

function formatLimit(maxBytes: number): string {
  return maxBytes >= 1024 ? `${Math.round(maxBytes / 1024)} KB` : `${maxBytes} bytes`;
}

/** Throws a 400 AiError when a field exceeds its cap. Runs against the raw body. */
export function enforceSizeCaps(body: unknown, caps: readonly SizeCap[]): void {
  if (typeof body !== 'object' || body === null) return;
  const record = body as Record<string, unknown>;
  for (const cap of caps) {
    if (!(cap.field in record)) continue;
    const size = byteSize(record[cap.field]);
    if (size > cap.maxBytes) {
      throw badRequestError(`The ${cap.label} is too large (limit ${formatLimit(cap.maxBytes)}).`, [
        { path: [cap.field], message: `Must be at most ${formatLimit(cap.maxBytes)}; received ${formatLimit(size)}.` },
      ]);
    }
  }
}

/** Size caps + zod. Throws a 400 AiError with per-field details on failure. */
export function validateRequest<T>(schema: ZodType<T>, caps: readonly SizeCap[], body: unknown): T {
  enforceSizeCaps(body, caps);
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)),
      message: issue.message,
    }));
    throw badRequestError('The request body is not valid.', details);
  }
  return result.data;
}
