/**
 * Resume store — every resume the user has, persisted to localStorage.
 *
 * Usage:
 *   const resume = useActiveResume();                       // Resume | undefined
 *   const update = useResumeStore(s => s.updateResume);     // (id, patch | updater) => void
 *   update(resume.id, r => ({ ...r, summary: 'new' }));
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from '@/stores/storage';
import type { Resume, ResumeId, SectionKey } from '@shared/types';
import { RESUME_SCHEMA_VERSION } from '@shared/types';
import { cloneResume, createBlankResume, createSampleResume } from '@/lib/resume/defaults';
import { nowIso } from '@/lib/id';

export type ResumeUpdater = Partial<Resume> | ((current: Resume) => Resume);

export interface ResumeStoreState {
  schemaVersion: number;
  resumes: Record<ResumeId, Resume>;
  activeResumeId: ResumeId | null;

  /** Create a blank (or sample) resume, make it active, return its id. */
  createResume: (opts?: { name?: string; fromSample?: boolean }) => ResumeId;
  /** Insert a fully formed resume (import). Makes it active. Returns id (a new one is assigned on collision). */
  addResume: (resume: Resume) => ResumeId;
  duplicateResume: (id: ResumeId) => ResumeId | null;
  deleteResume: (id: ResumeId) => void;
  renameResume: (id: ResumeId, name: string) => void;
  setActiveResume: (id: ResumeId) => void;
  /** Patch or functional update. Bumps updatedAt. No-op if id is unknown. */
  updateResume: (id: ResumeId, updater: ResumeUpdater) => void;
  /** Convenience helpers for section layout. */
  moveSection: (id: ResumeId, key: SectionKey, direction: 'up' | 'down') => void;
  setSectionOrder: (id: ResumeId, order: SectionKey[]) => void;
  toggleSectionHidden: (id: ResumeId, key: SectionKey) => void;
  /** Wipe everything (Settings → clear data). */
  reset: () => void;
}

export const useResumeStore = create<ResumeStoreState>()(
  persist(
    (set, get) => ({
      schemaVersion: RESUME_SCHEMA_VERSION,
      resumes: {},
      activeResumeId: null,

      createResume: (opts) => {
        const resume = opts?.fromSample ? createSampleResume() : createBlankResume(opts?.name);
        if (opts?.name) resume.name = opts.name;
        set((s) => ({ resumes: { ...s.resumes, [resume.id]: resume }, activeResumeId: resume.id }));
        return resume.id;
      },

      addResume: (incoming) => {
        const resume: Resume = { ...incoming };
        if (!resume.id || get().resumes[resume.id]) {
          resume.id = cloneResume(resume).id;
        }
        resume.updatedAt = nowIso();
        set((s) => ({ resumes: { ...s.resumes, [resume.id]: resume }, activeResumeId: resume.id }));
        return resume.id;
      },

      duplicateResume: (id) => {
        const src = get().resumes[id];
        if (!src) return null;
        const copy = cloneResume(src);
        set((s) => ({ resumes: { ...s.resumes, [copy.id]: copy }, activeResumeId: copy.id }));
        return copy.id;
      },

      deleteResume: (id) => {
        set((s) => {
          const resumes = { ...s.resumes };
          delete resumes[id];
          const remaining = Object.values(resumes).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          const activeResumeId = s.activeResumeId === id ? (remaining[0]?.id ?? null) : s.activeResumeId;
          return { resumes, activeResumeId };
        });
      },

      renameResume: (id, name) => get().updateResume(id, { name }),

      setActiveResume: (id) => {
        if (get().resumes[id]) set({ activeResumeId: id });
      },

      updateResume: (id, updater) => {
        set((s) => {
          const current = s.resumes[id];
          if (!current) return s;
          const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
          return { resumes: { ...s.resumes, [id]: { ...next, id, updatedAt: nowIso() } } };
        });
      },

      moveSection: (id, key, direction) => {
        get().updateResume(id, (r) => {
          const order = [...r.style.sectionOrder];
          const i = order.indexOf(key);
          if (i === -1) return r;
          const j = direction === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= order.length) return r;
          [order[i], order[j]] = [order[j], order[i]];
          return { ...r, style: { ...r.style, sectionOrder: order } };
        });
      },

      setSectionOrder: (id, order) => {
        get().updateResume(id, (r) => ({ ...r, style: { ...r.style, sectionOrder: [...order] } }));
      },

      toggleSectionHidden: (id, key) => {
        get().updateResume(id, (r) => {
          const hidden = new Set(r.style.hiddenSections);
          if (hidden.has(key)) hidden.delete(key);
          else hidden.add(key);
          return { ...r, style: { ...r.style, hiddenSections: [...hidden] } };
        });
      },

      reset: () => set({ resumes: {}, activeResumeId: null }),
    }),
    {
      name: 'launchpad.resumes.v1',
      storage: createSafeStorage(),
      version: RESUME_SCHEMA_VERSION,
      partialize: (s) => ({ schemaVersion: s.schemaVersion, resumes: s.resumes, activeResumeId: s.activeResumeId }),
    },
  ),
);

/** The currently selected resume, or undefined when none exists yet. */
export function useActiveResume(): Resume | undefined {
  return useResumeStore((s) => (s.activeResumeId ? s.resumes[s.activeResumeId] : undefined));
}

/** All resumes, newest edit first. */
export function useResumeList(): Resume[] {
  const resumes = useResumeStore((s) => s.resumes);
  return Object.values(resumes).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
