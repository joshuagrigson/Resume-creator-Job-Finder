/**
 * Executive — an oversized name with the headline directly beneath it, letter-spaced caps
 * section titles carrying a full-width rule, and dates in a right-hand column. Built for
 * senior and leadership applications where the title line has to land first.
 */
import { ContactLine, NameBlock, SectionBlock } from '../parts';
import type { TemplateProps } from './types';

export function ExecutiveTemplate({ resume, sections }: TemplateProps) {
  return (
    <div className="rp-body rp-body--executive">
      <header className="rp-header rp-header--executive">
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
