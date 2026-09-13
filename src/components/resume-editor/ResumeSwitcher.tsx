/** Switch between resumes and manage them: new, duplicate, rename, delete. */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, FilePlus2, Pencil, Sparkles, Trash2 } from 'lucide-react';
import type { ResumeId } from '@shared/types';
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Menu,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  Modal,
  useToast,
} from '@/components/ui';
import { useResumeList, useResumeStore } from '@/stores/resumeStore';

export interface ResumeSwitcherProps {
  activeId: ResumeId;
  /** Called whenever a different resume should become active (so the page can update the URL). */
  onSelect: (id: ResumeId) => void;
}

export function ResumeSwitcher({ activeId, onSelect }: ResumeSwitcherProps) {
  const resumes = useResumeList();
  const createResume = useResumeStore((s) => s.createResume);
  const duplicateResume = useResumeStore((s) => s.duplicateResume);
  const deleteResume = useResumeStore((s) => s.deleteResume);
  const renameResume = useResumeStore((s) => s.renameResume);
  const toast = useToast();

  const active = resumes.find((r) => r.id === activeId);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const renameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renaming) setDraftName(active?.name ?? '');
  }, [renaming, active?.name]);

  const submitRename = () => {
    const name = draftName.trim();
    if (!name) return;
    renameResume(activeId, name);
    setRenaming(false);
    toast.push({ title: 'Resume renamed', tone: 'success' });
  };

  const remove = () => {
    const removed = active;
    deleteResume(activeId);
    setConfirmingDelete(false);
    toast.push({ title: `Deleted ${removed?.name ?? 'resume'}`, tone: 'info' });
    const next = useResumeStore.getState().activeResumeId;
    if (next) onSelect(next);
  };

  return (
    <>
      <Menu
        label="Switch or manage resumes"
        align="start"
        className="re-switcher__menu"
        trigger={
          <Button variant="secondary" rightIcon={<ChevronDown size={14} />} className="re-switcher__trigger">
            <span className="truncate">{active?.name ?? 'Select a resume'}</span>
          </Button>
        }
      >
        <MenuGroupLabel>Your resumes</MenuGroupLabel>
        {resumes.map((resume) => (
          <MenuItem key={resume.id} checked={resume.id === activeId} onSelect={() => onSelect(resume.id)}>
            {resume.name}
          </MenuItem>
        ))}

        <MenuSeparator />
        <MenuGroupLabel>Create</MenuGroupLabel>
        <MenuItem
          icon={<FilePlus2 size={15} />}
          onSelect={() => {
            const id = createResume({ name: 'Untitled resume' });
            onSelect(id);
            toast.push({ title: 'Blank resume created', tone: 'success' });
          }}
        >
          New blank resume
        </MenuItem>
        <MenuItem
          icon={<Sparkles size={15} />}
          onSelect={() => {
            const id = createResume({ fromSample: true });
            onSelect(id);
            toast.push({ title: 'Sample resume created', description: 'Edit it into your own.', tone: 'success' });
          }}
        >
          New from sample
        </MenuItem>

        <MenuSeparator />
        <MenuGroupLabel>This resume</MenuGroupLabel>
        <MenuItem
          icon={<Copy size={15} />}
          onSelect={() => {
            const id = duplicateResume(activeId);
            if (id) {
              onSelect(id);
              toast.push({ title: 'Duplicated', tone: 'success' });
            }
          }}
        >
          Duplicate
        </MenuItem>
        <MenuItem icon={<Pencil size={15} />} onSelect={() => setRenaming(true)}>
          Rename…
        </MenuItem>
        <MenuItem danger icon={<Trash2 size={15} />} onSelect={() => setConfirmingDelete(true)}>
          Delete…
        </MenuItem>
      </Menu>

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename resume"
        description="This name is only used inside the app — it never prints."
        size="sm"
        initialFocusRef={renameRef}
        footer={
          <>
            <Button onClick={() => setRenaming(false)}>Cancel</Button>
            <Button variant="primary" disabled={!draftName.trim()} onClick={submitRename}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Resume name">
          <Input
            ref={renameRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitRename();
              }
            }}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={remove}
        destructive
        title={`Delete ${active?.name ?? 'this resume'}?`}
        description="This removes the resume from this browser. Export it first if you might need it."
        confirmLabel="Delete resume"
      />
    </>
  );
}
