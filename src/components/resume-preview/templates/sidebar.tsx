/**
 * Sidebar — a tinted left column (contact, skills, certifications, education) beside the main
 * narrative column (summary, experience, projects, custom sections).
 *
 * The two columns are a CSS grid, never a table, and every value is plain text, so the layout
 * reads as one linear document to a parser while looking designed to a human.
 */
import { ContactLine, SectionBlock } from '../parts';
import type { ResumeSection } from '@/lib/export/format';
import type { TemplateProps } from './types';

/** Section kinds that belong in the narrow left column. */
const ASIDE_KINDS = new Set(['skills', 'certifications', 'education']);

export function isAsideSection(section: ResumeSection): boolean {
  return ASIDE_KINDS.has(section.kind);
}

export function SidebarTemplate({ resume, sections }: TemplateProps) {
  const aside = sections.filter(isAsideSection);
  const main = sections.filter((section) => !isAsideSection(section));
  const name = (resume.contact?.fullName ?? '').trim();
  const headline = (resume.contact?.headline ?? '').trim();

  return (
    <div className="rp-body rp-body--sidebar">
      <aside className="rp-aside">
        <div className="rp-section rp-section--contact">
          <h2 className="rp-section-title">
            <span className="rp-section-title-text">Contact</span>
          </h2>
          <ContactLine resume={resume} layout="stack" />
        </div>
        {aside.map((section) => (
          <SectionBlock key={section.key} resume={resume} section={section} variant={{ itemHeader: 'stacked' }} />
        ))}
      </aside>

      <div className="rp-main">
        <header className="rp-header rp-header--sidebar">
          {name ? <h1 className="rp-name">{name}</h1> : null}
          {headline ? <p className="rp-headline">{headline}</p> : null}
        </header>
        <div className="rp-sections">
          {main.map((section) => (
            <SectionBlock key={section.key} resume={resume} section={section} variant={{ itemHeader: 'stacked' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
