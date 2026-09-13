/**
 * Narrow store access for the editor panels.
 *
 * Every panel subscribes only to the slice it renders, so typing in the summary does not
 * re-render the experience list (and vice versa).
 */
import { useCallback } from 'react';
import type { Resume, ResumeId } from '@shared/types';
import { useResumeStore } from '@/stores/resumeStore';

export type ResumeMutator = (resume: Resume) => Resume;

/** A stable `(updater) => void` bound to one resume id. */
export function useResumeUpdate(resumeId: ResumeId): (updater: ResumeMutator) => void {
  const updateResume = useResumeStore((s) => s.updateResume);
  return useCallback((updater: ResumeMutator) => updateResume(resumeId, updater), [updateResume, resumeId]);
}

/**
 * Subscribe to one slice of a resume. The selector must return a referentially stable value
 * (a field, an array already stored in state) — never a freshly built object.
 */
export function useResumeSlice<T>(resumeId: ResumeId, select: (resume: Resume) => T): T | undefined {
  return useResumeStore((s) => {
    const resume = s.resumes[resumeId];
    return resume ? select(resume) : undefined;
  });
}
