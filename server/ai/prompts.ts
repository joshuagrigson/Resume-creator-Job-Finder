/**
 * System/user prompt assembly and the JSON schemas used for structured output.
 *
 * The hard rule across every feature: the model may rephrase, reorder and emphasize what the
 * candidate already wrote, but it may never invent employers, titles, dates, degrees, tools or
 * numbers. When a metric would strengthen a line and the real number is unknown, it must emit a
 * bracketed placeholder such as "[X]%" for the candidate to fill in.
 */
import type { ResumeInput } from './schemas';

export const MAX_JOB_TEXT_CHARS = 12_000;
export const MAX_RESUME_CHARS = 20_000;
export const MAX_PASTED_RESUME_CHARS = 24_000;

export function truncate(text: string, maxChars: number): string {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).trimEnd()}\n…[truncated]`;
}

const HONESTY_RULES = [
  'Never invent experience, employers, job titles, dates, degrees, certifications, tools or metrics. Use only what the candidate supplied.',
  'Never state a number that is not already in the source material. When a metric would strengthen a line but the real value is unknown, write a bracketed placeholder such as "[X]%", "[X] hours/week" or "$[X]K" so the candidate can fill it in.',
  'Mirror wording from the job description only when the candidate\'s own material already supports it. Do not claim unfamiliar skills.',
].join('\n');

const VOICE_RULES = [
  'Write in resume voice: no first-person pronouns (I, me, my, we), no "responsible for", no filler.',
  'Start every bullet with a strong action verb — past tense for finished work, present tense for a current role.',
  'Keep every bullet to 30 words or fewer, one achievement per bullet, plain ASCII punctuation.',
  'Lead with the outcome, then the action and scope. Prefer concrete nouns over buzzwords.',
  'Return plain text only: no markdown, no bullet glyphs, no surrounding quotation marks.',
].join('\n');

const JSON_RULES = 'Respond with a single JSON object that matches the required schema. No prose, no code fences.';

function section(title: string, body: string): string {
  const trimmed = body.trim();
  return trimmed === '' ? '' : `${title}:\n${trimmed}\n`;
}

function dateRange(start: string, end: string, current: boolean): string {
  const from = start.trim();
  const to = current ? 'Present' : end.trim();
  if (!from && !to) return '';
  return ` (${from || '?'} – ${to || '?'})`;
}

/** Compact, token-cheap rendering of the resume for prompts. */
export function describeResume(resume: ResumeInput, options: { includeIds?: boolean } = {}): string {
  const { includeIds = false } = options;
  const lines: string[] = [];
  const c = resume.contact;

  const header: string[] = [];
  if (c.fullName.trim()) header.push(`Name: ${c.fullName.trim()}`);
  if (c.headline.trim()) header.push(`Headline: ${c.headline.trim()}`);
  if (c.location.trim()) header.push(`Location: ${c.location.trim()}`);
  lines.push(section('CANDIDATE', header.join('\n')));
  lines.push(section('SUMMARY', resume.summary));

  const experience = resume.experience
    .map((item) => {
      const label = includeIds ? `[experienceId: ${item.id || '(missing)'}] ` : '';
      const title = [item.title.trim(), item.company.trim()].filter(Boolean).join(' at ') || 'Role';
      const where = item.location.trim() ? `, ${item.location.trim()}` : '';
      const head = `- ${label}${title}${dateRange(item.startDate, item.endDate, item.current)}${where}`;
      const bullets = item.bullets
        .map((bullet, index) => ({ text: bullet.trim(), index }))
        .filter((entry) => entry.text !== '')
        .map((entry) => (includeIds ? `    bulletIndex ${entry.index}: ${entry.text}` : `    - ${entry.text}`));
      return [head, ...bullets].join('\n');
    })
    .join('\n');
  lines.push(section('EXPERIENCE', experience));

  const education = resume.education
    .map((item) => {
      const degree = [item.degree.trim(), item.field.trim()].filter(Boolean).join(' in ');
      const head = [degree, item.school.trim()].filter(Boolean).join(' — ');
      return `- ${head || 'Education'}${dateRange(item.startDate, item.endDate, false)}`;
    })
    .join('\n');
  lines.push(section('EDUCATION', education));

  const skills = resume.skillGroups
    .map((group) => `- ${group.name.trim() || 'Skills'}: ${group.skills.filter(Boolean).join(', ')}`)
    .join('\n');
  lines.push(section('SKILLS', skills));

  const projects = resume.projects
    .map((project) => {
      const head = `- ${project.name.trim() || 'Project'}${project.description.trim() ? ` — ${project.description.trim()}` : ''}`;
      const tech = project.technologies.filter(Boolean).join(', ');
      const bullets = project.bullets.filter(Boolean).map((bullet) => `    ${bullet.trim()}`);
      return [head, tech ? `    Tech: ${tech}` : '', ...bullets].filter(Boolean).join('\n');
    })
    .join('\n');
  lines.push(section('PROJECTS', projects));

  const certifications = resume.certifications
    .map((cert) => `- ${[cert.name.trim(), cert.issuer.trim()].filter(Boolean).join(' — ')}${cert.date.trim() ? ` (${cert.date.trim()})` : ''}`)
    .join('\n');
  lines.push(section('CERTIFICATIONS', certifications));

  const custom = resume.customSections
    .map((customSection) => {
      const items = customSection.items
        .map((item) => `    - ${[item.heading.trim(), item.subheading.trim(), item.date.trim()].filter(Boolean).join(' — ')}`)
        .join('\n');
      return `- ${customSection.title.trim() || 'Section'}\n${items}`.trimEnd();
    })
    .join('\n');
  lines.push(section('OTHER SECTIONS', custom));

  const text = lines.filter(Boolean).join('\n').trim();
  return truncate(text || 'The resume is empty.', MAX_RESUME_CHARS);
}

function jobBlock(jobText: string | undefined, jobTitle?: string, company?: string): string {
  const head: string[] = [];
  if (jobTitle?.trim()) head.push(`Target title: ${jobTitle.trim()}`);
  if (company?.trim()) head.push(`Company: ${company.trim()}`);
  const body = jobText?.trim() ? truncate(jobText, MAX_JOB_TEXT_CHARS) : '';
  if (head.length === 0 && body === '') return '';
  return `JOB POSTING:\n${[...head, body].filter(Boolean).join('\n')}`;
}

export interface Prompt {
  system: string;
  user: string;
}

const TONE_GUIDANCE: Record<string, string> = {
  concise: 'Tone: tight and factual. Cut every word that does not carry information.',
  impact: 'Tone: outcome-first. Lead each rewrite with the measurable result.',
  leadership: 'Tone: ownership and scope — teams led, decisions owned, cross-functional influence.',
  technical: 'Tone: technical specificity — systems, tools and methods actually named in the bullet.',
};

export function improveBulletPrompt(input: {
  bullet: string;
  role?: string;
  jobText?: string;
  tone?: keyof typeof TONE_GUIDANCE | string;
}): Prompt {
  const system = [
    'You are a senior resume editor who rewrites single achievement bullets for ATS-friendly resumes.',
    HONESTY_RULES,
    VOICE_RULES,
    'Produce exactly three distinct rewrites, best first: (1) quantified impact, (2) scope and ownership, (3) tight and skimmable.',
    'Each rewrite must stay factually equivalent to the original bullet.',
    JSON_RULES,
  ].join('\n\n');

  const toneLine = input.tone && TONE_GUIDANCE[input.tone] ? TONE_GUIDANCE[input.tone] : '';
  const user = [
    input.role?.trim() ? `ROLE CONTEXT: ${input.role.trim()}` : '',
    jobBlock(input.jobText),
    toneLine,
    `ORIGINAL BULLET:\n${input.bullet.trim()}`,
    'Rewrite it three ways.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

export function summaryPrompt(input: { resume: ResumeInput; jobText?: string }): Prompt {
  const system = [
    'You are a senior resume editor writing the professional summary that opens a resume.',
    HONESTY_RULES,
    VOICE_RULES,
    'The summary is 2–3 sentences (maximum 60 words): seniority and focus, the strongest proof points already on the resume, then the value offered.',
    'Also produce two shorter alternatives with a different emphasis. Never repeat the bullets verbatim.',
    JSON_RULES,
  ].join('\n\n');

  const user = [
    `RESUME:\n${describeResume(input.resume)}`,
    jobBlock(input.jobText),
    'Write the summary and two alternatives.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

export function tailorPrompt(input: {
  resume: ResumeInput;
  jobText: string;
  jobTitle?: string;
  company?: string;
}): Prompt {
  const system = [
    'You are a senior resume editor tailoring an existing resume to one specific job posting.',
    HONESTY_RULES,
    VOICE_RULES,
    'You may only rephrase, reorder, and re-emphasize existing content. Adding a responsibility the candidate never had is a failure.',
    'Every bullet suggestion must reference a real experienceId and a real bulletIndex exactly as given in the RESUME block; suggestions with invented identifiers are discarded.',
    'For non-bullet suggestions ("summary", "headline", "skill") leave experienceId empty and bulletIndex -1.',
    'Return 3–8 suggestions, highest impact first, plus keywordsToAdd: only keywords the job asks for that the resume already plausibly supports.',
    'The note is one sentence (max 30 words) on the overall gap between the resume and the posting.',
    JSON_RULES,
  ].join('\n\n');

  const user = [
    `RESUME:\n${describeResume(input.resume, { includeIds: true })}`,
    jobBlock(input.jobText, input.jobTitle, input.company),
    'Tailor this resume to the posting.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

export function coverLetterPrompt(input: {
  resume: ResumeInput;
  jobText: string;
  jobTitle?: string;
  company?: string;
  tone?: string;
  lengthWords?: number;
}): Prompt {
  const words = input.lengthWords ?? 250;
  const tone =
    input.tone === 'warm'
      ? 'Tone: warm and human, still professional.'
      : input.tone === 'direct'
        ? 'Tone: direct and brief — no throat-clearing.'
        : 'Tone: professional and confident.';

  const system = [
    'You are a career writer producing a cover letter that a hiring manager will actually finish reading.',
    HONESTY_RULES,
    `Structure: 3–4 short paragraphs, about ${words} words total. Open with the role and the single strongest reason to keep reading, then one or two paragraphs of concrete proof drawn from the resume, then a short close with a clear next step.`,
    tone,
    'First person is correct here (this is a letter, not a resume), but keep it concrete and free of clichés like "I am writing to apply".',
    'Never leave bracketed placeholders for details that were provided — use the real company name and role when given. Do not invent a hiring manager name; if none is known, open with "Dear Hiring Team,".',
    'End with a closing line ("Sincerely,") followed by the candidate\'s name on the final line.',
    'Return the letter as plain text only: no markdown, no subject line, no mailing addresses, no commentary.',
  ].join('\n\n');

  const user = [
    `RESUME:\n${describeResume(input.resume)}`,
    jobBlock(input.jobText, input.jobTitle, input.company),
    'Write the cover letter.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

export function parseResumePrompt(input: { text: string }): Prompt {
  const system = [
    'You convert pasted resume text into structured JSON. You are an extractor, not an editor.',
    'Copy the candidate\'s wording. Do not rewrite, summarize, improve, translate, or add anything that is not in the text.',
    'If a field is not present, return an empty string or an empty array — never null, never a guess, never a placeholder like "N/A".',
    'Dates use the "YYYY-MM" format. A year alone becomes "YYYY-01". "Present"/"Current" means endDate is "" and current is true.',
    'Bullets are one achievement each, with the leading glyph ("•", "-", "*") removed and no trailing period added.',
    'Skills: keep the candidate\'s grouping when the resume has labelled groups; otherwise use one group named "Skills".',
    'Sections that do not fit the known shapes (volunteering, awards, publications, languages) go into customSections.',
    JSON_RULES,
  ].join('\n\n');

  const user = `RESUME TEXT:\n${truncate(input.text, MAX_PASTED_RESUME_CHARS)}\n\nExtract it into the schema.`;
  return { system, user };
}

const POLISH_SHAPE: Record<string, string> = {
  summary: 'This is the professional summary: 2–3 sentences, third-person resume voice, no "I".',
  bullet: 'This is one achievement bullet: a single line, 30 words or fewer, starting with an action verb.',
  description: 'This is a short project description: one or two plain sentences.',
};

/**
 * Polish — the smart prompt that sits under a field. Unlike improve-bullet it is a copy editor,
 * not a writer: it rewords what he typed and nothing else. Missing facts become questions, never
 * placeholders or guesses, because the words land in his résumé the moment he taps Use.
 */
export function polishPrompt(input: {
  text: string;
  kind: string;
  role?: string;
  answers?: { question: string; answer: string }[];
}): Prompt {
  const system = [
    'You are a patient copy editor helping someone who writes the way they talk — slang, fragments, no punctuation, poor spelling. Turn what they typed into clean, professional resume wording.',
    'Reword only. Keep every fact exactly as given and add none: no numbers, tools, employers, titles, dates, team sizes, results or skills that are not in the text or in their answers. Do not write bracketed placeholders.',
    'You may drop filler, fix grammar and spelling, reorder, pick a stronger verb, and turn slang into plain professional words that mean the same thing ("ran the grill" → "Operated the grill line").',
    'If the text would be stronger with a fact that is missing — how many, how often, how big, what result — ask for the single most valuable one in "questions": one short, friendly, plain-English question written for someone with no résumé experience. At most one question. If nothing is missing, return an empty list.',
    'If the text is already clean, return it unchanged.',
    '"why" is one short line in plain words on what you changed, e.g. "Started with a verb and cut the slang." Empty string if nothing changed.',
    VOICE_RULES,
    JSON_RULES,
  ].join('\n\n');

  const answers = (input.answers ?? [])
    .filter((entry) => entry.answer.trim() !== '')
    .map((entry) => `Q: ${entry.question.trim()}\nA: ${entry.answer.trim()}`)
    .join('\n');

  const user = [
    POLISH_SHAPE[input.kind] ?? POLISH_SHAPE.description,
    input.role?.trim() ? `ROLE CONTEXT: ${input.role.trim()}` : '',
    answers ? `THEIR ANSWERS (facts you may now use):\n${answers}` : '',
    `WHAT THEY TYPED:\n${input.text.trim()}`,
    'Polish it.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

// ---------------------------------------------------------------------------
// JSON schemas for output_config.format
// ---------------------------------------------------------------------------

const STRING = { type: 'string' } as const;
const STRING_ARRAY = { type: 'array', items: { type: 'string' } } as const;

function object(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

export const IMPROVE_BULLET_OUTPUT_SCHEMA = object({
  suggestions: {
    type: 'array',
    minItems: 3,
    maxItems: 3,
    items: { type: 'string', description: 'A rewritten bullet, 30 words or fewer.' },
  },
});

export const SUMMARY_OUTPUT_SCHEMA = object({
  summary: { type: 'string', description: 'The recommended professional summary, 2–3 sentences.' },
  alternatives: { type: 'array', minItems: 2, maxItems: 2, items: STRING },
});

export const TAILOR_OUTPUT_SCHEMA = object({
  suggestions: {
    type: 'array',
    minItems: 1,
    maxItems: 8,
    items: object({
      type: { type: 'string', enum: ['summary', 'bullet', 'skill', 'headline'] },
      experienceId: { type: 'string', description: 'Exact experienceId from the resume; "" for non-bullet suggestions.' },
      bulletIndex: { type: 'integer', description: 'Zero-based bullet index; -1 for non-bullet suggestions.' },
      original: { type: 'string', description: 'The existing text being replaced; "" when adding something new.' },
      suggested: STRING,
      reason: { type: 'string', description: 'One short sentence tying the change to the posting.' },
    }),
  },
  keywordsToAdd: { type: 'array', maxItems: 20, items: STRING },
  note: STRING,
});

const PARSED_EXPERIENCE = object({
  company: STRING,
  title: STRING,
  location: STRING,
  startDate: STRING,
  endDate: STRING,
  current: { type: 'boolean' },
  bullets: STRING_ARRAY,
});

const PARSED_EDUCATION = object({
  school: STRING,
  degree: STRING,
  field: STRING,
  location: STRING,
  startDate: STRING,
  endDate: STRING,
  gpa: STRING,
  details: STRING_ARRAY,
});

const PARSED_SKILL_GROUP = object({ name: STRING, skills: STRING_ARRAY });

const PARSED_PROJECT = object({
  name: STRING,
  url: STRING,
  description: STRING,
  bullets: STRING_ARRAY,
  technologies: STRING_ARRAY,
});

const PARSED_CERTIFICATION = object({ name: STRING, issuer: STRING, date: STRING, url: STRING });

const PARSED_CUSTOM_SECTION = object({
  title: STRING,
  items: {
    type: 'array',
    items: object({ heading: STRING, subheading: STRING, date: STRING, bullets: STRING_ARRAY }),
  },
});

export const PARSE_RESUME_OUTPUT_SCHEMA = object({
  contact: object({
    fullName: STRING,
    headline: STRING,
    email: STRING,
    phone: STRING,
    location: STRING,
    website: STRING,
    linkedin: STRING,
    github: STRING,
  }),
  summary: STRING,
  experience: { type: 'array', items: PARSED_EXPERIENCE },
  education: { type: 'array', items: PARSED_EDUCATION },
  skillGroups: { type: 'array', items: PARSED_SKILL_GROUP },
  projects: { type: 'array', items: PARSED_PROJECT },
  certifications: { type: 'array', items: PARSED_CERTIFICATION },
  customSections: { type: 'array', items: PARSED_CUSTOM_SECTION },
});

export const POLISH_OUTPUT_SCHEMA = object({
  polished: { type: 'string', description: 'The reworded text. Same facts, nothing added.' },
  why: { type: 'string', description: 'One short plain-English line on what changed; "" if nothing.' },
  questions: {
    type: 'array',
    maxItems: 1,
    items: { type: 'string', description: 'A short friendly question asking for the one most valuable missing fact.' },
  },
});
