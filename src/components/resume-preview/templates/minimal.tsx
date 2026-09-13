/**
 * Minimal — generous whitespace, light weights and hairline dividers. Says "designer" without
 * using a single graphic, so it still parses cleanly.
 */
import { ContactLine, NameBlock, SectionBlock } from '../parts';
import type { TemplateProps } from './types';

export function MinimalTemplate({ resume, sections }: TemplateProps) {
  return (
    <div className="rp-body rp-body--minimal">
      <header className="rp-header rp-header--minimal">
        <NameBlock resume={resume} />
        <ContactLine resume={resume} separator="/" />
      </header>

      <div className="rp-sections">
        {sections.map((section) => (
          <SectionBlock key={section.key} resume={resume} section={section} variant={{ itemHeader: 'stacked' }} />
        ))}
      </div>
    </div>
  );
}
