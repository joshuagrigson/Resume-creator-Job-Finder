import type { ReactElement } from 'react';
import type { Resume, TemplateId } from '@shared/types';
import type { ResumeSection } from '@/lib/export/format';

export interface TemplateProps {
  resume: Resume;
  /** Already ordered, de-hidden and emptied-out by `resumeSections()`. */
  sections: ResumeSection[];
}

export type TemplateComponent = (props: TemplateProps) => ReactElement | null;

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
}
