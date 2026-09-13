import type { TemplateId } from '@shared/types';
import { ClassicTemplate } from './classic';
import { ModernTemplate } from './modern';
import { MinimalTemplate } from './minimal';
import { ExecutiveTemplate } from './executive';
import { SidebarTemplate } from './sidebar';
import type { TemplateComponent, TemplateMeta } from './types';

export type { TemplateComponent, TemplateMeta, TemplateProps } from './types';
export { ClassicTemplate, ModernTemplate, MinimalTemplate, ExecutiveTemplate, SidebarTemplate };

/** Picker metadata — id, human name and a one-line "when to use this". */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Serif type, centered name and thin rules. The safe choice for traditional industries.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold sans name with accent-barred section titles. Clean and current.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Light weights, hairline dividers and lots of air. Understated and easy to skim.',
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Large name, headline up top and letter-spaced caps. Built for senior roles.',
  },
  {
    id: 'sidebar',
    name: 'Sidebar',
    description: 'Tinted left column for contact and skills, main column for your story.',
  },
];

export const TEMPLATE_COMPONENTS: Record<TemplateId, TemplateComponent> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  executive: ExecutiveTemplate,
  sidebar: SidebarTemplate,
};

export function templateMeta(id: TemplateId | undefined): TemplateMeta {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[1]!;
}

export function templateComponent(id: TemplateId | undefined): TemplateComponent {
  return (id && TEMPLATE_COMPONENTS[id]) || ModernTemplate;
}
