/**
 * Classic — the traditional, conservative resume: serif type, a centered name, thin rules and
 * small-caps section titles. Safe for law, finance, academia and government applications.
 */
import { ContactLine, NameBlock, SectionBlock } from '../parts';
import type { TemplateProps } from './types';

export function ClassicTemplate({ resume, sections }: TemplateProps) {
  return (
    <div className="rp-body rp-body--classic">
      <header className="rp-header rp-header--classic">
        <NameBlock resume={resume} />
        <ContactLine resume={resume} separator="·" />
      </header>

      <div className="rp-sections">
        {sections.map((section) => (
          <SectionBlock key={section.key} resume={resume} section={section} variant={{ itemHeader: 'inline' }} />
        ))}
      </div>
    </div>
  );
}
