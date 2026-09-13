/**
 * Resume preview — the page-sized sheet, the five templates, and the picker swatch.
 *
 *   import { ResumePreview, TEMPLATES, TemplateThumb } from '@/components/resume-preview';
 */

export {
  ResumePreview,
  PAGE_SPECS,
  DENSITY_SPECS,
  FONT_STACKS,
  type ResumePreviewProps,
} from './ResumePreview';

export { TemplateThumb, type TemplateThumbProps } from './TemplateThumb';
export { PagesIndicator, estimatePages, type PagesIndicatorProps } from './PagesIndicator';

export {
  TEMPLATES,
  TEMPLATE_COMPONENTS,
  templateMeta,
  templateComponent,
  ClassicTemplate,
  ModernTemplate,
  MinimalTemplate,
  ExecutiveTemplate,
  SidebarTemplate,
  type TemplateComponent,
  type TemplateMeta,
  type TemplateProps,
} from './templates';

export {
  BulletList,
  ContactLine,
  DateRange,
  NameBlock,
  SectionBlock,
  SectionBody,
  SectionTitle,
  type SectionVariant,
} from './parts';

export { resumeSections, type ResumeSection, type SectionKind } from '@/lib/export/format';
