// @vitest-environment jsdom
import { DEFAULT_ACCENT } from '@/lib/export/color';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TEMPLATE_IDS, type TemplateId } from '@shared/types';
import { createSampleResume } from '@/lib/resume/defaults';
import {
  PagesIndicator,
  ResumePreview,
  TEMPLATES,
  TemplateThumb,
  estimatePages,
  templateComponent,
  templateMeta,
} from '@/components/resume-preview';

afterEach(cleanup);

function renderTemplate(template: TemplateId) {
  const resume = createSampleResume();
  resume.style = { ...resume.style, template };
  return render(<ResumePreview resume={resume} scale={0.4} />);
}

describe('TEMPLATES', () => {
  it('describes exactly the five template ids from the shared types', () => {
    expect(TEMPLATES.map((template) => template.id)).toEqual([...TEMPLATE_IDS]);
    for (const template of TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(2);
      expect(template.description.length).toBeGreaterThan(20);
    }
  });

  it('resolves a component for every id and falls back safely', () => {
    for (const id of TEMPLATE_IDS) {
      expect(typeof templateComponent(id)).toBe('function');
    }
    expect(typeof templateComponent(undefined)).toBe('function');
    expect(templateMeta('sidebar').name).toBe('Sidebar');
    expect(templateMeta(undefined).id).toBe('modern');
  });
});

describe('template layouts', () => {
  it('classic centres the header and uses an inline "Title, Company" item head', () => {
    const { container } = renderTemplate('classic');
    expect(container.querySelector('.rp-header--classic')).not.toBeNull();
    const title = container.querySelector('.rp-item--experience .rp-item-title') as HTMLElement;
    expect(title.textContent).toBe('Marketing Operations Manager, Ocean Canyon Resorts');
    // The company sits inside the title element, not on its own line.
    expect(title.querySelector('.rp-item-org')).not.toBeNull();
  });

  it('modern stacks the company under the role', () => {
    const { container } = renderTemplate('modern');
    const head = container.querySelector('.rp-item--experience .rp-item-head') as HTMLElement;
    expect(head.querySelector('.rp-item-title')?.textContent).toBe('Marketing Operations Manager');
    expect(head.querySelector(':scope > .rp-item-headline > .rp-item-org')?.textContent).toBe('Ocean Canyon Resorts');
    expect(head.querySelector('.rp-dates')?.textContent).toBe('Mar 2021 – Present');
  });

  it('minimal and executive render the shared body with their own chrome', () => {
    const minimal = renderTemplate('minimal');
    expect(minimal.container.querySelector('.rp-body--minimal')).not.toBeNull();
    cleanup();

    const executive = renderTemplate('executive');
    expect(executive.container.querySelector('.rp-body--executive')).not.toBeNull();
    expect(executive.container.querySelector('.rp-header--executive .rp-headline')?.textContent).toBe(
      'Marketing Operations Manager',
    );
  });

  it('sidebar splits contact, skills, certifications and education into the aside column', () => {
    const { container } = renderTemplate('sidebar');
    const aside = container.querySelector('.rp-aside') as HTMLElement;
    const main = container.querySelector('.rp-main') as HTMLElement;
    expect(aside).not.toBeNull();
    expect(main).not.toBeNull();

    const asideKeys = Array.from(aside.querySelectorAll('.rp-section[data-section]')).map((n) =>
      n.getAttribute('data-section'),
    );
    const mainKeys = Array.from(main.querySelectorAll('.rp-section[data-section]')).map((n) =>
      n.getAttribute('data-section'),
    );

    expect(asideKeys.sort()).toEqual(['certifications', 'education', 'skills']);
    expect(mainKeys).toEqual(['summary', 'experience', 'projects']);

    // Contact lives in the sidebar, the name in the main column.
    expect(aside.querySelector('.rp-contact--stack')).not.toBeNull();
    expect(main.querySelector('.rp-name')?.textContent).toBe('Jordan Rivera');
    // Two columns via grid — never a table.
    expect(container.querySelector('table')).toBeNull();
  });

  it('gives each template a distinct sheet class so the CSS can differentiate them', () => {
    const seen = new Set<string>();
    for (const id of TEMPLATE_IDS) {
      const { container } = renderTemplate(id);
      const sheet = container.querySelector('.rp-sheet') as HTMLElement;
      const templateClass = Array.from(sheet.classList).find((name) => name.startsWith('rp-sheet--'));
      expect(templateClass).toBe(`rp-sheet--${id}`);
      seen.add(templateClass!);
      cleanup();
    }
    expect(seen.size).toBe(TEMPLATE_IDS.length);
  });
});

describe('TemplateThumb', () => {
  it('renders a decorative swatch for every template', () => {
    for (const id of TEMPLATE_IDS) {
      const { container } = render(<TemplateThumb templateId={id} accentColor="#c8860d" />);
      const thumb = container.querySelector('.rp-thumb') as HTMLElement;
      expect(thumb.classList.contains(`rp-thumb--${id}`)).toBe(true);
      expect(thumb.getAttribute('aria-hidden')).toBe('true');
      expect(thumb.style.getPropertyValue('--rp-thumb-accent')).toBe('#c8860d');
      expect(thumb.textContent).toBe('');
      cleanup();
    }
  });

  it('falls back to the app accent for an invalid colour', () => {
    const { container } = render(<TemplateThumb templateId="modern" accentColor="not-a-color" />);
    const thumb = container.querySelector('.rp-thumb') as HTMLElement;
    expect(thumb.style.getPropertyValue('--rp-thumb-accent')).toBe(DEFAULT_ACCENT);
  });
});

describe('PagesIndicator', () => {
  it('estimates at least one page and reads as plain English', () => {
    const resume = createSampleResume();
    expect(estimatePages(resume)).toBeGreaterThanOrEqual(1);

    const { container } = render(<PagesIndicator resume={resume} />);
    expect(container.textContent).toMatch(/^About \d+(\.5)? pages?$/);
  });

  it('grows the estimate as the resume grows', () => {
    const short = createSampleResume();
    short.experience = [];
    short.projects = [];
    const long = createSampleResume();
    long.experience = [...long.experience, ...long.experience, ...long.experience, ...long.experience];

    expect(estimatePages(long)).toBeGreaterThan(estimatePages(short));
  });
});
