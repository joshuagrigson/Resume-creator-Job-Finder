/** Portfolio / side projects with a description, bullets and a technology list. */
import { Plus } from 'lucide-react';
import type { ProjectItem, ResumeId } from '@shared/types';
import { Button, EmptyState, Field, Input, Textarea, useToast } from '@/components/ui';
import { createProjectItem } from '@/lib/resume/defaults';
import { uid } from '@/lib/id';
import { BulletListEditor } from './BulletListEditor';
import { ItemToolbar } from './ItemToolbar';
import { TagInput } from './TagInput';
import { moveItem } from './sections';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

export interface ProjectsFormProps {
  resumeId: ResumeId;
}

export function ProjectsForm({ resumeId }: ProjectsFormProps) {
  const projects = useResumeSlice(resumeId, (r) => r.projects);
  const update = useResumeUpdate(resumeId);
  const toast = useToast();

  if (!projects) return null;

  const setItems = (next: ProjectItem[]) => update((r) => ({ ...r, projects: next }));
  const patch = (id: string, changes: Partial<ProjectItem>) =>
    setItems(projects.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const add = () => setItems([...projects, createProjectItem()]);

  const remove = (index: number) => {
    const removed = projects[index];
    if (!removed) return;
    setItems(projects.filter((_, i) => i !== index));
    toast.push({
      title: `Removed ${removed.name.trim() || 'project'}`,
      tone: 'info',
      durationMs: 6000,
      action: {
        label: 'Undo',
        onClick: () =>
          update((r) => {
            const next = [...r.projects];
            next.splice(Math.min(index, next.length), 0, removed);
            return { ...r, projects: next };
          }),
      },
    });
  };

  const duplicate = (index: number) => {
    const source = projects[index];
    if (!source) return;
    const next = [...projects];
    next.splice(index + 1, 0, {
      ...source,
      id: uid('prj'),
      bullets: [...source.bullets],
      technologies: [...source.technologies],
    });
    setItems(next);
  };

  return (
    <div className="stack-4">
      {projects.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          title="No projects yet"
          description="Great for career changers: show what you built, not just where you worked."
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={add}>
              Add a project
            </Button>
          }
        />
      ) : null}

      {projects.map((item, index) => (
        <article className="re-item" key={item.id}>
          <header className="re-item__head">
            <h4 className="re-item__title">{item.name.trim() || 'Untitled project'}</h4>
            <ItemToolbar
              itemLabel={item.name.trim() || 'project'}
              index={index}
              count={projects.length}
              onMove={(dir) => setItems(moveItem(projects, index, dir === 'up' ? index - 1 : index + 1))}
              onDuplicate={() => duplicate(index)}
              onDelete={() => remove(index)}
            />
          </header>

          <div className="re-grid">
            <Field label="Project name">
              <Input
                value={item.name}
                placeholder="Agent Coaching Platform"
                onChange={(e) => patch(item.id, { name: e.target.value })}
              />
            </Field>
            <Field label="Link" hint="Optional — a repo, demo or case study.">
              <Input
                value={item.url}
                inputMode="url"
                placeholder="github.com/you/project"
                onChange={(e) => patch(item.id, { url: e.target.value })}
              />
            </Field>
            <Field label="One-line description" className="re-grid__wide">
              <Textarea
                rows={2}
                autoResize
                value={item.description}
                placeholder="Internal web app that transcribes calls and grades reps against a benchmark."
                onChange={(e) => patch(item.id, { description: e.target.value })}
              />
            </Field>
          </div>

          <TagInput
            label="Technologies"
            value={item.technologies}
            onChange={(technologies) => patch(item.id, { technologies })}
            placeholder="React, Cloudflare Workers…"
          />

          <BulletListEditor
            legend={`Highlights for ${item.name.trim() || 'this project'}`}
            bullets={item.bullets}
            addLabel="Add highlight"
            placeholder="What changed because this exists? Add a number if you have one."
            onChange={(bullets) => patch(item.id, { bullets })}
          />
        </article>
      ))}

      {projects.length > 0 ? (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={add}>
          Add a project
        </Button>
      ) : null}
    </div>
  );
}
