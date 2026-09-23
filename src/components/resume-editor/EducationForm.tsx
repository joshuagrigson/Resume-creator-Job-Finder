/** Schools, degrees, dates and optional highlight lines. */
import { Plus } from 'lucide-react';
import type { EducationItem, ResumeId } from '@shared/types';
import { Button, EmptyState, Field, Input, useToast } from '@/components/ui';
import { createEducationItem } from '@/lib/resume/defaults';
import { uid } from '@/lib/id';
import { BulletListEditor } from './BulletListEditor';
import { DateInput } from './DateInput';
import { ItemToolbar } from './ItemToolbar';
import { moveItem } from './sections';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

export interface EducationFormProps {
  resumeId: ResumeId;
}

export function EducationForm({ resumeId }: EducationFormProps) {
  const education = useResumeSlice(resumeId, (r) => r.education);
  const update = useResumeUpdate(resumeId);
  const toast = useToast();

  if (!education) return null;

  const setItems = (next: EducationItem[]) => update((r) => ({ ...r, education: next }));
  const patch = (id: string, changes: Partial<EducationItem>) =>
    setItems(education.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const add = () => setItems([...education, createEducationItem()]);

  const remove = (index: number) => {
    const removed = education[index];
    if (!removed) return;
    setItems(education.filter((_, i) => i !== index));
    toast.push({
      title: `Removed ${describe(removed)}`,
      tone: 'info',
      durationMs: 6000,
      action: {
        label: 'Undo',
        onClick: () =>
          update((r) => {
            const next = [...r.education];
            next.splice(Math.min(index, next.length), 0, removed);
            return { ...r, education: next };
          }),
      },
    });
  };

  const duplicate = (index: number) => {
    const source = education[index];
    if (!source) return;
    const next = [...education];
    next.splice(index + 1, 0, { ...source, id: uid('edu'), details: [...source.details] });
    setItems(next);
  };

  return (
    <div className="stack-4">
      {education.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          title="No education added"
          description="Degrees, bootcamps and trade programs all belong here."
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={add}>
              Add a school
            </Button>
          }
        />
      ) : null}

      {education.map((item, index) => (
        <article className="re-item" key={item.id}>
          <header className="re-item__head">
            <h4 className="re-item__title">{describe(item)}</h4>
            <ItemToolbar
              itemLabel={describe(item)}
              index={index}
              count={education.length}
              onMove={(dir) => setItems(moveItem(education, index, dir === 'up' ? index - 1 : index + 1))}
              onDuplicate={() => duplicate(index)}
              onDelete={() => remove(index)}
            />
          </header>

          <div className="re-grid">
            <Field label="School" className="re-grid__wide">
              <Input
                value={item.school}
                placeholder="Texas A&M University–Texarkana"
                onChange={(e) => patch(item.id, { school: e.target.value })}
              />
            </Field>
            <Field label="Degree">
              <Input spellFix value={item.degree} placeholder="B.B.A." onChange={(e) => patch(item.id, { degree: e.target.value })} />
            </Field>
            <Field label="Field of study">
              <Input spellFix value={item.field} placeholder="Marketing" onChange={(e) => patch(item.id, { field: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input
                value={item.location}
                placeholder="Texarkana, TX"
                onChange={(e) => patch(item.id, { location: e.target.value })}
              />
            </Field>
            <Field label="GPA" hint="Optional — include it only if it helps.">
              <Input value={item.gpa} placeholder="3.7" onChange={(e) => patch(item.id, { gpa: e.target.value })} />
            </Field>
            <DateInput label="Start" value={item.startDate} onChange={(v) => patch(item.id, { startDate: v })} />
            <DateInput
              label="End"
              value={item.endDate}
              hint="Or the expected graduation month"
              onChange={(v) => patch(item.id, { endDate: v })}
            />
          </div>

          <BulletListEditor
            legend={`Highlights for ${describe(item)}`}
            bullets={item.details}
            addLabel="Add highlight"
            placeholder="Honors, relevant coursework, or a leadership role."
            onChange={(details) => patch(item.id, { details })}
          />
        </article>
      ))}

      {education.length > 0 ? (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={add}>
          Add a school
        </Button>
      ) : null}
    </div>
  );
}

function describe(item: EducationItem): string {
  const degree = [item.degree.trim(), item.field.trim()].filter(Boolean).join(', ');
  const school = item.school.trim();
  if (degree && school) return `${degree} — ${school}`;
  return degree || school || 'Untitled education entry';
}
