/**
 * The left-hand editor: a fixed Contact panel followed by every resume section as a
 * drag-to-reorder collapsible panel.
 *
 * This component deliberately subscribes only to the section *layout* (order, hidden keys and
 * custom-section titles). Field values are read inside the individual panels, so typing in one
 * section never re-renders the others.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronsDownUp, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import type { CustomSection, ResumeId, SectionKey } from '@shared/types';
import { BUILT_IN_SECTIONS } from '@shared/types';
import { Button, IconButton, useToast } from '@/components/ui';
import { useResumeStore } from '@/stores/resumeStore';
import { CertificationsForm } from './CertificationsForm';
import { ContactForm } from './ContactForm';
import { CustomSectionForm, useCustomSectionActions } from './CustomSectionsForm';
import { EducationForm } from './EducationForm';
import { ExperienceForm } from './ExperienceForm';
import { ProjectsForm } from './ProjectsForm';
import { SectionPanel } from './SectionPanel';
import { SkillsForm } from './SkillsForm';
import { SummaryForm } from './SummaryForm';
import {
  BUILT_IN_SECTION_LABELS,
  customSectionId,
  customSectionKey,
  sectionSummary,
} from './sections';
import { useResumeSlice } from './store-hooks';

const CONTACT_PANEL = 'contact';
const DEFAULT_OPEN = [CONTACT_PANEL, 'summary', 'experience'];

export interface ResumeEditorProps {
  resumeId: ResumeId;
}

export function ResumeEditor({ resumeId }: ResumeEditorProps) {
  const sectionOrder = useResumeSlice(resumeId, (r) => r.style.sectionOrder);
  const hiddenSections = useResumeSlice(resumeId, (r) => r.style.hiddenSections);
  const customSections = useResumeSlice(resumeId, (r) => r.customSections);
  const setSectionOrder = useResumeStore((s) => s.setSectionOrder);
  const moveSection = useResumeStore((s) => s.moveSection);
  const toggleSectionHidden = useResumeStore((s) => s.toggleSectionHidden);
  const custom = useCustomSectionActions(resumeId);
  const toast = useToast();

  const [open, setOpen] = useState<string[]>(DEFAULT_OPEN);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const keys = useMemo(
    () => orderedKeys(sectionOrder ?? [], customSections ?? []),
    [sectionOrder, customSections],
  );

  const toggleOpen = useCallback((key: string) => {
    setOpen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(active.id as SectionKey);
    const to = keys.indexOf(over.id as SectionKey);
    if (from === -1 || to === -1) return;
    setSectionOrder(resumeId, arrayMove(keys, from, to));
  };

  if (!sectionOrder || !customSections) return null;

  const hidden = new Set(hiddenSections ?? []);
  const labelFor = (key: SectionKey) => {
    const cid = customSectionId(key);
    if (cid) return customSections.find((s) => s.id === cid)?.title?.trim() || 'Custom section';
    return BUILT_IN_SECTION_LABELS[key] ?? key;
  };

  return (
    <div className="re-editor">
      <div className="re-editor__bar">
        <p className="re-editor__barTitle">Sections</p>
        <div className="row">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<ChevronsUpDown size={14} />}
            onClick={() => setOpen([CONTACT_PANEL, ...keys])}
          >
            Expand all
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<ChevronsDownUp size={14} />} onClick={() => setOpen([])}>
            Collapse all
          </Button>
        </div>
      </div>

      <SectionPanel
        sortable={false}
        id={CONTACT_PANEL}
        title="Contact & header"
        summary={<ContactSummary resumeId={resumeId} />}
        open={open.includes(CONTACT_PANEL)}
        onToggleOpen={() => toggleOpen(CONTACT_PANEL)}
        index={0}
        count={1}
      >
        <ContactForm resumeId={resumeId} />
      </SectionPanel>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <div className="re-editor__sections">
            {keys.map((key, index) => {
              const cid = customSectionId(key);
              const title = labelFor(key);
              return (
                <SectionPanel
                  key={key}
                  id={key}
                  title={title}
                  summary={<SectionSummary resumeId={resumeId} sectionKey={key} />}
                  open={open.includes(key)}
                  onToggleOpen={() => toggleOpen(key)}
                  hidden={hidden.has(key)}
                  onToggleHidden={() => toggleSectionHidden(resumeId, key)}
                  index={index}
                  count={keys.length}
                  onMove={(direction) => moveSection(resumeId, key, direction)}
                  headerExtra={
                    cid ? (
                      <IconButton
                        size="sm"
                        variant="danger"
                        label={`Delete the ${title} section`}
                        icon={<Trash2 size={15} />}
                        onClick={() => {
                          custom.remove(cid);
                          toast.push({ title: `Deleted ${title}`, tone: 'info' });
                        }}
                      />
                    ) : null
                  }
                >
                  <SectionBody resumeId={resumeId} sectionKey={key} />
                </SectionPanel>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className="re-editor__foot">
        <Button
          variant="secondary"
          leftIcon={<Plus size={15} />}
          onClick={() => {
            const id = custom.add();
            setOpen((prev) => [...prev, customSectionKey(id)]);
          }}
        >
          Add custom section
        </Button>
      </div>
    </div>
  );
}

/** Section keys in the user's order, with any unlisted section appended. Hidden keys stay. */
function orderedKeys(order: readonly SectionKey[], customSections: readonly CustomSection[]): SectionKey[] {
  const known: SectionKey[] = [...BUILT_IN_SECTIONS, ...customSections.map((s) => customSectionKey(s.id))];
  const knownSet = new Set<SectionKey>(known);
  const out: SectionKey[] = [];
  const seen = new Set<SectionKey>();
  for (const key of order) {
    if (!knownSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of known) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function ContactSummary({ resumeId }: { resumeId: ResumeId }) {
  const name = useResumeSlice(resumeId, (r) => r.contact.fullName.trim());
  return <>{name || 'Add your name'}</>;
}

function SectionSummary({ resumeId, sectionKey }: { resumeId: ResumeId; sectionKey: SectionKey }) {
  const text = useResumeSlice(resumeId, (r) => sectionSummary(r, sectionKey));
  return <>{text ?? ''}</>;
}

function SectionBody({ resumeId, sectionKey }: { resumeId: ResumeId; sectionKey: SectionKey }) {
  const cid = customSectionId(sectionKey);
  if (cid) return <CustomSectionForm resumeId={resumeId} sectionId={cid} />;
  switch (sectionKey) {
    case 'summary':
      return <SummaryForm resumeId={resumeId} />;
    case 'experience':
      return <ExperienceForm resumeId={resumeId} />;
    case 'education':
      return <EducationForm resumeId={resumeId} />;
    case 'skills':
      return <SkillsForm resumeId={resumeId} />;
    case 'projects':
      return <ProjectsForm resumeId={resumeId} />;
    case 'certifications':
      return <CertificationsForm resumeId={resumeId} />;
    default:
      return null;
  }
}
