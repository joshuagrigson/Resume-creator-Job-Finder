/** Public surface of the resume editor module. */
export { ResumeEditor, type ResumeEditorProps } from './ResumeEditor';
export { SectionPanel, type SectionPanelProps } from './SectionPanel';
export { BulletListEditor, type BulletListEditorProps } from './BulletListEditor';
export { DateInput, isInvalidMonth, type DateInputProps } from './DateInput';
export { TagInput, splitTags, type TagInputProps } from './TagInput';
export { ItemToolbar, type ItemToolbarProps } from './ItemToolbar';

export { ContactForm, type ContactFormProps } from './ContactForm';
export { SummaryForm, type SummaryFormProps } from './SummaryForm';
export { ExperienceForm, type ExperienceFormProps } from './ExperienceForm';
export { EducationForm, type EducationFormProps } from './EducationForm';
export { SkillsForm, type SkillsFormProps } from './SkillsForm';
export { ProjectsForm, type ProjectsFormProps } from './ProjectsForm';
export { CertificationsForm, type CertificationsFormProps } from './CertificationsForm';
export {
  CustomSectionForm,
  useCustomSectionActions,
  type CustomSectionFormProps,
  type CustomSectionActions,
} from './CustomSectionsForm';

export { StylePanel, TEMPLATE_META, ACCENT_SWATCHES, type StylePanelProps } from './StylePanel';
export { ExportMenu, type ExportMenuProps } from './ExportMenu';
export { ImportDialog, type ImportDialogProps } from './ImportDialog';
export { AtsPanel, type AtsPanelProps } from './AtsPanel';
export { ResumeSwitcher, type ResumeSwitcherProps } from './ResumeSwitcher';
export { PreviewFrame, PAGE_WIDTH_PX, type PreviewFrameProps } from './PreviewFrame';

export {
  BUILT_IN_SECTION_LABELS,
  customSectionId,
  customSectionKey,
  editorSectionKeys,
  isCustomSectionKey,
  moveItem,
  sectionLabel,
  sectionSummary,
} from './sections';
export { useResumeSlice, useResumeUpdate, type ResumeMutator } from './store-hooks';
