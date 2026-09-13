/**
 * Match scores for a page of jobs, computed against the active resume.
 *
 * Scoring is pure and client-side (the resume never leaves the browser). It is cheap per
 * call but a search page runs it 25–50 times, so results are cached per
 * `resume identity + job id` and reused while the user pages, sorts and clicks around.
 */
import { useMemo, useRef } from 'react';
import type { Job, MatchResult, Resume } from '@shared/types';
import { scoreJobMatch, type ResumeProfile } from '@shared/match';
import { resumeProfile } from '@/lib/resume/profile';

/** Identity of a resume for caching purposes — changes whenever its content changes. */
function profileKey(resume: Resume | undefined): string {
  if (!resume) return '';
  return `${resume.id}@${resume.updatedAt}`;
}

/** Memoized `ResumeProfile` for the active resume (undefined when there is no resume). */
export function useResumeProfile(resume: Resume | undefined): ResumeProfile | undefined {
  const key = profileKey(resume);
  // Keyed on the resume identity rather than the object so an unrelated store write
  // (a new search, a tracked job) does not re-flatten the whole resume.
  return useMemo(() => (resume ? resumeProfile(resume) : undefined), [key]);
}

/**
 * `Map<jobId, MatchResult>` for the given jobs. Empty when there is no resume yet, so
 * callers can simply check `matches.size` before offering match-based sorting.
 */
export function useJobMatches(jobs: readonly Job[], resume: Resume | undefined): Map<string, MatchResult> {
  const profile = useResumeProfile(resume);
  const key = profileKey(resume);
  const cache = useRef<{ key: string; entries: Map<string, MatchResult> }>({ key, entries: new Map() });

  return useMemo(() => {
    const out = new Map<string, MatchResult>();
    if (!profile) {
      cache.current = { key, entries: new Map() };
      return out;
    }
    if (cache.current.key !== key) cache.current = { key, entries: new Map() };
    const entries = cache.current.entries;
    for (const job of jobs) {
      let result = entries.get(job.id);
      if (!result) {
        result = scoreJobMatch(profile, job);
        entries.set(job.id, result);
      }
      out.set(job.id, result);
    }
    return out;
  }, [jobs, profile, key]);
}
