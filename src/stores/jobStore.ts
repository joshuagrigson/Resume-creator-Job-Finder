/**
 * Job store — search state (not persisted) + tracked jobs and saved searches (persisted).
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from '@/stores/storage';
import type { ApplicationStatus, Job, JobSearchQuery, JobSearchResponse, TrackedJob } from '@shared/types';
import { api, ApiClientError } from '@/lib/api';
import { nowIso, uid } from '@/lib/id';

export interface SavedSearch {
  id: string;
  name: string;
  query: JobSearchQuery;
  createdAt: string;
}

export const DEFAULT_QUERY: JobSearchQuery = {
  q: '',
  location: '',
  remoteOnly: false,
  sources: [],
  postedWithinDays: 30,
  page: 1,
  pageSize: 25,
  sort: 'relevance',
};

export interface JobStoreState {
  // --- search (ephemeral) ---
  query: JobSearchQuery;
  results: JobSearchResponse | null;
  loading: boolean;
  error: string | null;
  /** Job currently open in the detail panel. */
  selectedJobId: string | null;
  /** Last search's jobs by id so detail views can find them quickly. */
  jobsById: Record<string, Job>;

  setQuery: (patch: Partial<JobSearchQuery>) => void;
  /** Runs the search with the current query (merged with `patch`). Resolves when done; errors are stored, not thrown. */
  search: (patch?: Partial<JobSearchQuery>) => Promise<void>;
  selectJob: (id: string | null) => void;

  // --- tracker (persisted) ---
  tracked: Record<string, TrackedJob>;
  savedSearches: SavedSearch[];

  trackJob: (job: Job, status?: ApplicationStatus, resumeId?: string) => void;
  untrackJob: (jobId: string) => void;
  setStatus: (jobId: string, status: ApplicationStatus) => void;
  setNotes: (jobId: string, notes: string) => void;
  setFollowUp: (jobId: string, date: string | undefined) => void;
  setTrackedResume: (jobId: string, resumeId: string | undefined) => void;
  isTracked: (jobId: string) => boolean;

  saveSearch: (name: string, query: JobSearchQuery) => void;
  deleteSavedSearch: (id: string) => void;

  reset: () => void;
}

export const useJobStore = create<JobStoreState>()(
  persist(
    (set, get) => ({
      query: { ...DEFAULT_QUERY },
      results: null,
      loading: false,
      error: null,
      selectedJobId: null,
      jobsById: {},

      setQuery: (patch) => set((s) => ({ query: { ...s.query, ...patch } })),

      search: async (patch) => {
        const query = { ...get().query, ...(patch ?? {}) };
        set({ query, loading: true, error: null });
        try {
          const results = await api.searchJobs(query);
          const jobsById: Record<string, Job> = { ...get().jobsById };
          for (const job of results.jobs) jobsById[job.id] = job;
          set({ results, jobsById, loading: false });
        } catch (e) {
          const msg = e instanceof ApiClientError ? e.message : 'Search failed';
          set({ loading: false, error: msg });
        }
      },

      selectJob: (id) => set({ selectedJobId: id }),

      tracked: {},
      savedSearches: [],

      trackJob: (job, status = 'saved', resumeId) => {
        const ts = nowIso();
        set((s) => {
          const existing = s.tracked[job.id];
          const entry: TrackedJob = existing
            ? { ...existing, status, updatedAt: ts, resumeId: resumeId ?? existing.resumeId }
            : { job, status, notes: '', resumeId, savedAt: ts, updatedAt: ts };
          if (status === 'applied' && !entry.appliedAt) entry.appliedAt = ts;
          return { tracked: { ...s.tracked, [job.id]: entry } };
        });
      },

      untrackJob: (jobId) =>
        set((s) => {
          const tracked = { ...s.tracked };
          delete tracked[jobId];
          return { tracked };
        }),

      setStatus: (jobId, status) =>
        set((s) => {
          const t = s.tracked[jobId];
          if (!t) return s;
          const ts = nowIso();
          const next: TrackedJob = { ...t, status, updatedAt: ts };
          if (status === 'applied' && !next.appliedAt) next.appliedAt = ts;
          return { tracked: { ...s.tracked, [jobId]: next } };
        }),

      setNotes: (jobId, notes) =>
        set((s) => {
          const t = s.tracked[jobId];
          if (!t) return s;
          return { tracked: { ...s.tracked, [jobId]: { ...t, notes, updatedAt: nowIso() } } };
        }),

      setFollowUp: (jobId, date) =>
        set((s) => {
          const t = s.tracked[jobId];
          if (!t) return s;
          return { tracked: { ...s.tracked, [jobId]: { ...t, followUpOn: date, updatedAt: nowIso() } } };
        }),

      setTrackedResume: (jobId, resumeId) =>
        set((s) => {
          const t = s.tracked[jobId];
          if (!t) return s;
          return { tracked: { ...s.tracked, [jobId]: { ...t, resumeId, updatedAt: nowIso() } } };
        }),

      isTracked: (jobId) => Boolean(get().tracked[jobId]),

      saveSearch: (name, query) =>
        set((s) => ({
          savedSearches: [{ id: uid('srch'), name, query: { ...query, page: 1 }, createdAt: nowIso() }, ...s.savedSearches],
        })),

      deleteSavedSearch: (id) => set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),

      reset: () => set({ tracked: {}, savedSearches: [], results: null, jobsById: {}, selectedJobId: null, error: null }),
    }),
    {
      name: 'launchpad.jobs.v1',
      storage: createSafeStorage(),
      version: 1,
      partialize: (s) => ({ tracked: s.tracked, savedSearches: s.savedSearches, query: s.query }),
    },
  ),
);

/**
 * Tracked jobs sorted by most recently updated.
 *
 * Memoized on the `tracked` record: without this the hook returned a brand-new array on
 * every render, so consumers keying a `useMemo` on it (the tracker re-scores every
 * tracked job against the resume) recomputed on every unrelated keystroke.
 */
export function useTrackedJobs(): TrackedJob[] {
  const tracked = useJobStore((s) => s.tracked);
  return useMemo(
    () => Object.values(tracked).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tracked],
  );
}
