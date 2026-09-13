// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { Resume, SectionKey } from '@shared/types';
import { TEMPLATE_IDS } from '@shared/types';
import { createSampleResume, createCustomSection } from '@/lib/resume/defaults';
import { ResumePreview } from '@/components/resume-preview';

afterEach(cleanup);

function sectionKeys(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.rp-section[data-section]')).map(
    (node) => node.getAttribute('data-section') ?? '',
  );
}

function withCustomSection(resume: Resume): Resume {
  const custom = createCustomSection({
    title: 'Speaking',
    items: [
      {
        id: 'cust-1',
        heading: 'Call Center Summit',
        subheading: 'Panelist',
        date: '2024-05',
        bullets: ['Ran a 40-minute session on benchmark-call coaching for 120 attendees.'],
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

describe('ResumePreview', () => {
  it('renders the sheet with the name, headline and contact details', () => {
    const resume = createSampleResume();
    const { container } = render(<ResumePreview resume={resume} scale={0.5} id="preview-sheet" />);

    const sheet = container.querySelector('#preview-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet?.classList.contains('rp-sheet')).toBe(true);

    expect(screen.getByRole('heading', { level: 1, name: 'Jordan Rivera' })).toBeTruthy();
    expect(container.querySelector('.rp-headline')?.textContent).toBe('Marketing Operations Manager');
    expect(screen.getByText('jordan.rivera@example.com')).toBeTruthy();
    // Links print as display text, never with a protocol.
    expect(screen.getByText('linkedin.com/in/jordanrivera')).toBeTruthy();
    expect(container.textContent).not.toContain('https://');
  });

  it.each(TEMPLATE_IDS)('renders every section for the %s template', (template) => {
    const resume = withCustomSection(createSampleResume());
    resume.style = { ...resume.style, template };
    const { container } = render(<ResumePreview resume={resume} scale={0.4} />);

    expect(container.querySelector(`.rp-sheet--${template}`)).not.toBeNull();

    const keys = sectionKeys(container);
    expect(keys).toContain('summary');
    expect(keys).toContain('experience');
    expect(keys).toContain('skills');
    expect(keys).toContain('education');
    expect(keys).toContain('projects');
    expect(keys).toContain('certifications');
    expect(keys.some((key) => key.startsWith('custom:'))).toBe(true);

    // Content lands, whatever the layout.
    expect(container.textContent).toContain('Ocean Canyon Resorts');
    expect(container.textContent).toContain('Speaking');
    expect(container.textContent).toContain('Call Center Summit');
  });

  it('renders sections in style.sectionOrder', () => {
    const resume = createSampleResume();
    resume.style = {
      ...resume.style,
      template: 'modern',
      sectionOrder: ['experience', 'summary', 'education', 'skills', 'certifications', 'projects'],
    };
    const { container } = render(<ResumePreview resume={resume} scale={0.4} />);

    expect(sectionKeys(container)).toEqual([
      'experience',
      'summary',
      'education',
      'skills',
      'certifications',
      'projects',
    ]);
  });

  it('omits hidden sections and never prints an empty heading', () => {
    const resume = createSampleResume();
    resume.projects = [];
    resume.style = { ...resume.style, hiddenSections: ['certifications'] };
    const { container } = render(<ResumePreview resume={resume} scale={0.4} />);

    const keys = sectionKeys(container);
    expect(keys).not.toContain('certifications');
    // Empty data means no heading either, even though the section is not hidden.
    expect(keys).not.toContain('projects');
    expect(container.textContent).not.toContain('Projects');

    const headings = Array.from(container.querySelectorAll('.rp-section-title')).map((n) => n.textContent?.trim());
    expect(headings.every((text) => Boolean(text))).toBe(true);
  });

  it('renders bullets as a real list so an ATS can read them', () => {
    const resume = createSampleResume();
    const { container } = render(<ResumePreview resume={resume} scale={0.4} />);

    const experience = container.querySelector('.rp-section[data-section="experience"]') as HTMLElement;
    const lists = within(experience).getAllByRole('list');
    expect(lists.length).toBeGreaterThan(0);

    const bullets = experience.querySelectorAll('ul.rp-bullets > li');
    expect(bullets.length).toBe(resume.experience[0]!.bullets.length + resume.experience[1]!.bullets.length);
    expect(bullets[0]?.textContent).toContain('Lead a 14-rep call center');
    // No table markup anywhere — tables break resume parsers.
    expect(container.querySelector('table')).toBeNull();
  });

  it('drops empty bullets rather than printing blank list items', () => {
    const resume = createSampleResume();
    resume.experience[0]!.bullets = ['Real achievement.', '   ', ''];
    const { container } = render(<ResumePreview resume={resume} scale={0.4} />);

    const firstItem = container.querySelector('.rp-item--experience') as HTMLElement;
    expect(firstItem.querySelectorAll('li').length).toBe(1);
  });

  it('applies page size, density, font and accent to the sheet', () => {
    const resume = createSampleResume();
    resume.style = {
      ...resume.style,
      pageSize: 'a4',
      density: 'compact',
      font: 'serif',
      fontSize: 11,
      accentColor: '#0d8342',
    };
    const { container } = render(<ResumePreview resume={resume} scale={0.6} />);

    const wrapper = container.querySelector('.rp-preview') as HTMLElement;
    expect(wrapper.dataset.pageSize).toBe('a4');
    expect(wrapper.dataset.density).toBe('compact');
    expect(wrapper.dataset.font).toBe('serif');
    expect(wrapper.style.getPropertyValue('--rp-page-w')).toBe('210mm');
    expect(wrapper.style.getPropertyValue('--rp-pad')).toBe('0.6in');
    expect(wrapper.style.getPropertyValue('--rp-accent')).toBe('#0d8342');
    expect(wrapper.style.getPropertyValue('--rp-scale')).toBe('0.6');

    const sheet = container.querySelector('.rp-sheet') as HTMLElement;
    expect(sheet.style.fontSize).toBe('11pt');

    // The @page rule follows the paper choice so the print has no browser margins.
    expect(container.querySelector('style')?.textContent).toBe('@page{size:A4;margin:0}');
  });

  it('clamps a nonsense scale and font size instead of breaking the layout', () => {
    const resume = createSampleResume();
    resume.style = { ...resume.style, fontSize: Number.NaN };
    const { container } = render(<ResumePreview resume={resume} scale={99} />);

    const wrapper = container.querySelector('.rp-preview') as HTMLElement;
    expect(wrapper.style.getPropertyValue('--rp-scale')).toBe('2');
    expect((container.querySelector('.rp-sheet') as HTMLElement).style.fontSize).toBe('10.5pt');
  });

  it('shows a helpful placeholder for a brand-new empty resume', () => {
    const empty: Resume = {
      ...createSampleResume(),
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
      experience: [],
      education: [],
      skillGroups: [],
      projects: [],
      certifications: [],
      customSections: [],
    };
    render(<ResumePreview resume={empty} scale={0.5} />);
    expect(screen.getByText(/Your resume preview appears here/i)).toBeTruthy();
  });

  it('names the sheet for assistive technology', () => {
    render(<ResumePreview resume={createSampleResume()} scale={0.5} />);
    expect(screen.getByLabelText('Resume preview — Jordan Rivera')).toBeTruthy();
  });
});
