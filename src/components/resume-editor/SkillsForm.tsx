/** Skill groups (name + chips) plus suggestions mined from the resume's own bullets. */
import { useMemo } from 'react';
import { Plus, Wand2 } from 'lucide-react';
import type { ResumeId, SkillGroup } from '@shared/types';
import { extractSkills } from '@shared/keywords';
import { Button, EmptyState, Field, Input, useToast } from '@/components/ui';
import { createSkillGroup } from '@/lib/resume/defaults';
import { ItemToolbar } from './ItemToolbar';
import { TagInput } from './TagInput';
import { moveItem } from './sections';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

const MAX_SUGGESTIONS = 14;

export interface SkillsFormProps {
  resumeId: ResumeId;
}

export function SkillsForm({ resumeId }: SkillsFormProps) {
  const groups = useResumeSlice(resumeId, (r) => r.skillGroups);
  const summary = useResumeSlice(resumeId, (r) => r.summary);
  const experience = useResumeSlice(resumeId, (r) => r.experience);
  const projects = useResumeSlice(resumeId, (r) => r.projects);
  const update = useResumeUpdate(resumeId);
  const toast = useToast();

  const suggestions = useMemo(() => {
    if (!groups) return [];
    const corpus = [
      summary ?? '',
      ...(experience ?? []).flatMap((item) => [item.title, ...item.bullets]),
      ...(projects ?? []).flatMap((item) => [item.name, item.description, ...item.bullets, ...item.technologies]),
    ].join('\n');
    const listed = new Set(groups.flatMap((g) => g.skills).map((s) => s.trim().toLowerCase()));
    return extractSkills(corpus)
      .filter((skill) => !listed.has(skill.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS);
  }, [groups, summary, experience, projects]);

  if (!groups) return null;

  const setGroups = (next: SkillGroup[]) => update((r) => ({ ...r, skillGroups: next }));
  const patch = (id: string, changes: Partial<SkillGroup>) =>
    setGroups(groups.map((g) => (g.id === id ? { ...g, ...changes } : g)));

  const add = () => setGroups([...groups, createSkillGroup({ name: groups.length === 0 ? 'Skills' : '' })]);

  const remove = (index: number) => {
    const removed = groups[index];
    if (!removed) return;
    setGroups(groups.filter((_, i) => i !== index));
    toast.push({
      title: `Removed ${removed.name.trim() || 'skill group'}`,
      tone: 'info',
      durationMs: 6000,
      action: {
        label: 'Undo',
        onClick: () =>
          update((r) => {
            const next = [...r.skillGroups];
            next.splice(Math.min(index, next.length), 0, removed);
            return { ...r, skillGroups: next };
          }),
      },
    });
  };

  const addSuggestion = (skill: string) => {
    update((r) => {
      const next = r.skillGroups.length ? [...r.skillGroups] : [createSkillGroup({ name: 'Skills' })];
      const first = next[0] as SkillGroup;
      next[0] = { ...first, skills: [...first.skills, skill] };
      return { ...r, skillGroups: next };
    });
  };

  return (
    <div className="stack-4">
      {groups.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          title="No skill groups"
          description="Group skills so recruiters scan them fast — for example “Tools” and “Leadership”."
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={add}>
              Add a group
            </Button>
          }
        />
      ) : null}

      {groups.map((group, index) => (
        <article className="re-item" key={group.id}>
          <header className="re-item__head">
            <h4 className="re-item__title">{group.name.trim() || 'Untitled group'}</h4>
            <ItemToolbar
              itemLabel={group.name.trim() || 'skill group'}
              index={index}
              count={groups.length}
              onMove={(dir) => setGroups(moveItem(groups, index, dir === 'up' ? index - 1 : index + 1))}
              onDelete={() => remove(index)}
            />
          </header>

          <Field label="Group name" hint="Leave blank to print the skills without a label.">
            <Input
              value={group.name}
              placeholder="Marketing & Sales Ops"
              onChange={(e) => patch(group.id, { name: e.target.value })}
            />
          </Field>

          <TagInput
            label="Skills"
            value={group.skills}
            onChange={(skills) => patch(group.id, { skills })}
            placeholder="HubSpot, Salesforce, lead scoring…"
            hint="Press Enter or comma to add. Pasting a comma-separated list splits it."
          />
        </article>
      ))}

      {groups.length > 0 ? (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={add}>
          Add a group
        </Button>
      ) : null}

      {suggestions.length > 0 ? (
        <section className="re-suggest" aria-labelledby={`re-suggest-${resumeId}`}>
          <h4 className="re-suggest__title" id={`re-suggest-${resumeId}`}>
            <Wand2 size={14} aria-hidden="true" />
            Found in your bullets
          </h4>
          <p className="subtle small">These skills appear in your experience but are not listed above.</p>
          <ul className="re-suggest__list">
            {suggestions.map((skill) => (
              <li key={skill}>
                <Button
                  size="sm"
                  variant="secondary"
                  className="re-suggest__chip"
                  leftIcon={<Plus size={12} />}
                  aria-label={`Add ${skill} to your skills`}
                  onClick={() => addSuggestion(skill)}
                >
                  {skill}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
