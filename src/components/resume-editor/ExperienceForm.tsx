/** Work history: company, title, location, dates, and achievement bullets. */
import { Plus } from 'lucide-react';
import type { ExperienceItem, ResumeId } from '@shared/types';
import { Button, EmptyState, Field, Input, useToast } from '@/components/ui';
import { createExperienceItem } from '@/lib/resume/defaults';
import { uid } from '@/lib/id';
import { BulletListEditor } from './BulletListEditor';
import { DateInput } from './DateInput';
import { ItemToolbar } from './ItemToolbar';
import { moveItem } from './sections';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

export interface ExperienceFormProps {
  resumeId: ResumeId;
}

export function ExperienceForm({ resumeId }: ExperienceFormProps) {
  const experience = useResumeSlice(resumeId, (r) => r.experience);
  const update = useResumeUpdate(resumeId);
  const toast = useToast();

  if (!experience) return null;

  const setItems = (next: ExperienceItem[]) => update((r) => ({ ...r, experience: next }));

  const patch = (id: string, changes: Partial<ExperienceItem>) =>
    setItems(experience.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const add = () => setItems([...experience, createExperienceItem()]);

  const remove = (index: number) => {
    const removed = experience[index];
    if (!removed) return;
    setItems(experience.filter((_, i) => i !== index));
    toast.push({
      title: `Removed ${describe(removed)}`,
      tone: 'info',
      durationMs: 6000,
      action: {
        label: 'Undo',
        onClick: () =>
          update((r) => {
            const next = [...r.experience];
            next.splice(Math.min(index, next.length), 0, removed);
            return { ...r, experience: next };
          }),
      },
    });
  };

  const duplicate = (index: number) => {
    const source = experience[index];
    if (!source) return;
    const copy: ExperienceItem = { ...source, id: uid('exp'), bullets: [...source.bullets] };
    const next = [...experience];
    next.splice(index + 1, 0, copy);
    setItems(next);
  };

  return (
    <div className="stack-4">
      {experience.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          title="No roles yet"
          description="Add your most recent job first — recruiters read top-down."
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={add}>
              Add a role
            </Button>
          }
        />
      ) : null}

      {experience.map((item, index) => (
        <article className="re-item" key={item.id}>
          <header className="re-item__head">
            <h4 className="re-item__title">{describe(item)}</h4>
            <ItemToolbar
              itemLabel={describe(item)}
              index={index}
              count={experience.length}
              onMove={(dir) => setItems(moveItem(experience, index, dir === 'up' ? index - 1 : index + 1))}
              onDuplicate={() => duplicate(index)}
              onDelete={() => remove(index)}
            />
          </header>

          <div className="re-grid">
            <Field label="Job title">
              <Input spellFix
                value={item.title}
                placeholder="Marketing Operations Manager"
                onChange={(e) => patch(item.id, { title: e.target.value })}
              />
            </Field>
            <Field label="Company">
              <Input
                value={item.company}
                placeholder="Ocean Canyon Resorts"
                onChange={(e) => patch(item.id, { company: e.target.value })}
              />
            </Field>
            <Field label="Location" className="re-grid__wide">
              <Input
                value={item.location}
                placeholder="Texarkana, TX — or Remote"
                onChange={(e) => patch(item.id, { location: e.target.value })}
              />
            </Field>
            <DateInput label="Start" value={item.startDate} onChange={(v) => patch(item.id, { startDate: v })} />
            <DateInput
              label="End"
              value={item.current ? '' : item.endDate}
              disabled={item.current}
              hint={item.current ? 'Shown as “Present”' : 'Month and year'}
              onChange={(v) => patch(item.id, { endDate: v })}
              current={item.current}
              onCurrentChange={(current) => patch(item.id, { current, endDate: current ? '' : item.endDate })}
              currentLabel="I work here now"
            />
          </div>

          <BulletListEditor
            legend={`Achievements for ${describe(item)}`}
            bullets={item.bullets}
            aiRole={[item.title, item.company].filter(Boolean).join(' at ') || undefined}
            onChange={(bullets) => patch(item.id, { bullets })}
          />
        </article>
      ))}

      {experience.length > 0 ? (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={add}>
          Add a role
        </Button>
      ) : null}
    </div>
  );
}

function describe(item: ExperienceItem): string {
  const title = item.title.trim();
  const company = item.company.trim();
  if (title && company) return `${title} at ${company}`;
  return title || company || 'Untitled role';
}
