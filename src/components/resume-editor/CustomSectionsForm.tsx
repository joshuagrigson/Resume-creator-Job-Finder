/**
 * User-defined sections ("Volunteering", "Publications", "Awards" …).
 *
 * Adding a section appends `custom:<id>` to `style.sectionOrder`; deleting removes it from
 * both the order and the hidden list so no dangling keys are left behind.
 */
import { useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { CustomSection, CustomSectionItem, ResumeId, SectionKey } from '@shared/types';
import { Button, EmptyState, Field, Input, useToast } from '@/components/ui';
import { createCustomSection } from '@/lib/resume/defaults';
import { uid } from '@/lib/id';
import { useResumeStore } from '@/stores/resumeStore';
import { BulletListEditor } from './BulletListEditor';
import { DateInput } from './DateInput';
import { ItemToolbar } from './ItemToolbar';
import { customSectionKey, moveItem } from './sections';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

export interface CustomSectionActions {
  /** Creates a section, appends its key to the section order, and returns the new id. */
  add: (title?: string) => string;
  rename: (sectionId: string, title: string) => void;
  remove: (sectionId: string) => void;
}

export function useCustomSectionActions(resumeId: ResumeId): CustomSectionActions {
  const updateResume = useResumeStore((s) => s.updateResume);

  const add = useCallback(
    (title = 'New section') => {
      const section = createCustomSection({ title, items: [emptyItem()] });
      updateResume(resumeId, (r) => ({
        ...r,
        customSections: [...r.customSections, section],
        style: { ...r.style, sectionOrder: [...r.style.sectionOrder, customSectionKey(section.id)] },
      }));
      return section.id;
    },
    [resumeId, updateResume],
  );

  const rename = useCallback(
    (sectionId: string, title: string) => {
      updateResume(resumeId, (r) => ({
        ...r,
        customSections: r.customSections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
      }));
    },
    [resumeId, updateResume],
  );

  const remove = useCallback(
    (sectionId: string) => {
      const key: SectionKey = customSectionKey(sectionId);
      updateResume(resumeId, (r) => ({
        ...r,
        customSections: r.customSections.filter((s) => s.id !== sectionId),
        style: {
          ...r.style,
          sectionOrder: r.style.sectionOrder.filter((k) => k !== key),
          hiddenSections: r.style.hiddenSections.filter((k) => k !== key),
        },
      }));
    },
    [resumeId, updateResume],
  );

  return { add, rename, remove };
}

function emptyItem(): CustomSectionItem {
  return { id: uid('cit'), heading: '', subheading: '', date: '', bullets: [] };
}

export interface CustomSectionFormProps {
  resumeId: ResumeId;
  sectionId: string;
}

/** The body of a single custom section panel. */
export function CustomSectionForm({ resumeId, sectionId }: CustomSectionFormProps) {
  const sections = useResumeSlice(resumeId, (r) => r.customSections);
  const update = useResumeUpdate(resumeId);
  const { rename } = useCustomSectionActions(resumeId);
  const toast = useToast();

  const section = sections?.find((s) => s.id === sectionId);
  if (!section) return null;

  const setItems = (next: CustomSectionItem[]) =>
    update((r) => ({
      ...r,
      customSections: r.customSections.map((s) => (s.id === sectionId ? { ...s, items: next } : s)),
    }));

  const patch = (id: string, changes: Partial<CustomSectionItem>) =>
    setItems(section.items.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const add = () => setItems([...section.items, emptyItem()]);

  const remove = (index: number) => {
    const removed = section.items[index];
    if (!removed) return;
    setItems(section.items.filter((_, i) => i !== index));
    toast.push({
      title: `Removed ${removed.heading.trim() || 'entry'}`,
      tone: 'info',
      durationMs: 6000,
      action: {
        label: 'Undo',
        onClick: () =>
          update((r) => ({
            ...r,
            customSections: r.customSections.map((s) => {
              if (s.id !== sectionId) return s;
              const next = [...s.items];
              next.splice(Math.min(index, next.length), 0, removed);
              return { ...s, items: next };
            }),
          })),
      },
    });
  };

  return (
    <div className="stack-4">
      <Field label="Section title" hint="Prints as the heading on your resume.">
        <Input value={section.title} placeholder="Volunteering" onChange={(e) => rename(sectionId, e.target.value)} />
      </Field>

      {section.items.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          title="No entries yet"
          description="Each entry gets a heading, an optional subheading and date, and bullets."
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={add}>
              Add an entry
            </Button>
          }
        />
      ) : null}

      {section.items.map((item, index) => (
        <article className="re-item" key={item.id}>
          <header className="re-item__head">
            <h4 className="re-item__title">{item.heading.trim() || 'Untitled entry'}</h4>
            <ItemToolbar
              itemLabel={item.heading.trim() || 'entry'}
              index={index}
              count={section.items.length}
              onMove={(dir) => setItems(moveItem(section.items, index, dir === 'up' ? index - 1 : index + 1))}
              onDuplicate={() => {
                const next = [...section.items];
                next.splice(index + 1, 0, { ...item, id: uid('cit'), bullets: [...item.bullets] });
                setItems(next);
              }}
              onDelete={() => remove(index)}
            />
          </header>

          <div className="re-grid">
            <Field label="Heading">
              <Input
                value={item.heading}
                placeholder="Habitat for Humanity"
                onChange={(e) => patch(item.id, { heading: e.target.value })}
              />
            </Field>
            <Field label="Subheading" hint="Optional — a role, publisher or location.">
              <Input
                value={item.subheading}
                placeholder="Site volunteer"
                onChange={(e) => patch(item.id, { subheading: e.target.value })}
              />
            </Field>
            <DateInput label="Date" value={item.date} onChange={(v) => patch(item.id, { date: v })} />
          </div>

          <BulletListEditor
            legend={`Details for ${item.heading.trim() || 'this entry'}`}
            bullets={item.bullets}
            addLabel="Add detail"
            placeholder="What did you do, and what came of it?"
            onChange={(bullets) => patch(item.id, { bullets })}
          />
        </article>
      ))}

      {section.items.length > 0 ? (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={add}>
          Add an entry
        </Button>
      ) : null}
    </div>
  );
}

export type { CustomSection };
