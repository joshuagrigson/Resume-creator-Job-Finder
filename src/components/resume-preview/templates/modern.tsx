/**
 * Modern — bold sans name, a two-line header with the contact details on their own row, and
 * section titles marked by an accent bar. The default for most tech / operations roles.
 */
import { ContactLine, NameBlock, SectionBlock } from '../parts';
import type { TemplateProps } from './types';

export function ModernTemplate({ resume, sections }: TemplateProps) {
  return (
    <div className="rp-body rp-body--modern">
      <header className="rp-header rp-header--modern">
        <NameBlock resume={resume} />
        <ContactLine resume={resume} separator="·" />
      </header>

      <div className="rp-sections">
        {sections.map((section) => (
          <SectionBlock key={section.key} resume={resume} section={section} variant={{ itemHeader: 'stacked' }} />
        ))}
      </div>
    </div>
  );
}
