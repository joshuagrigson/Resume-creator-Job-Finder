/**
 * Job finder — search aggregated boards, see how each posting matches the active resume,
 * and open the full posting in a side panel (desktop) or bottom sheet (mobile).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, MapPin, SearchX, X } from 'lucide-react';
import type { Job, JobSearchQuery, JobSearchResponse, JobSource } from '@shared/types';
import { api } from '@/lib/api';
import { useJobStore, type SavedSearch } from '@/stores/jobStore';
import { useActiveResume } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Badge, Button, Drawer, EmptyState, PageHeader, Skeleton, useToast } from '@/components/ui';
import { useMediaQuery } from '@/hooks';
import {
  FiltersBar,
  JobDetail,
  JobList,
  Pagination,
  SavedSearches,
  SearchBar,
  SourceStatusStrip,
  isZipLocation,
  rangeLabel,
  useJobMatches,
  type SortMode,
} from '@/components/jobs';
import '@/components/jobs/jobs.css';

const WIDE = '(min-width: 1024px)';

const EXAMPLE_SEARCHES = [
  'Marketing operations',
  'React developer',
  'Customer support',
  'Registered nurse',
  'Diesel mechanic',
  'Data analyst',
];

export default function JobFinderPage() {
  const { jobId } = useParams<{ jobId?: string }>();
  const toast = useToast();
  const isWide = useMediaQuery(WIDE);

  const query = useJobStore((s) => s.query);
  const results = useJobStore((s) => s.results);
  const loading = useJobStore((s) => s.loading);
  const error = useJobStore((s) => s.error);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const jobsById = useJobStore((s) => s.jobsById);
  const tracked = useJobStore((s) => s.tracked);
  const savedSearches = useJobStore((s) => s.savedSearches);
  const search = useJobStore((s) => s.search);
  const selectJob = useJobStore((s) => s.selectJob);
  const trackJob = useJobStore((s) => s.trackJob);
  const untrackJob = useJobStore((s) => s.untrackJob);
  const saveSearch = useJobStore((s) => s.saveSearch);
  const deleteSavedSearch = useJobStore((s) => s.deleteSavedSearch);

  const resume = useActiveResume();
  const health = useSettingsStore((s) => s.health);
  const homeZip = useSettingsStore((s) => s.homeZip);
  const setHomeZip = useSettingsStore((s) => s.setHomeZip);

  // An empty location box starts from home.
  const [draft, setDraft] = useState({ q: query.q, location: query.location || homeZip || '' });
  const [sort, setSort] = useState<SortMode>(
    query.sort === 'date' ? 'date' : query.sort === 'distance' && isZipLocation(query.location) ? 'distance' : 'relevance',
  );
  const [headlineSearch, setHeadlineSearch] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deepJob, setDeepJob] = useState<Job | null>(null);
  const [deepState, setDeepState] = useState<'idle' | 'loading' | 'missing'>('idle');

  const resultsTop = useRef<HTMLDivElement>(null);

  // --- keep the search fields in step with the store (saved searches, deep links) ------
  const syncedQuery = useRef(`${query.q}|${query.location ?? ''}`);
  useEffect(() => {
    const key = `${query.q}|${query.location ?? ''}`;
    if (key === syncedQuery.current) return;
    syncedQuery.current = key;
    setDraft({ q: query.q, location: query.location ?? '' });
  }, [query.q, query.location]);

  // --- first visit: run something useful instead of showing an empty page -------------
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (results || loading) return;
    const keywords = query.q.trim();
    const home = !query.location && homeZip ? { location: homeZip } : {};
    if (keywords) {
      void search({ page: 1, ...home });
      return;
    }
    const headline = resume?.contact?.headline?.trim();
    if (headline) {
      setHeadlineSearch(headline);
      void search({ q: headline, page: 1, ...home });
    }
  }, [homeZip, loading, query.location, query.q, results, resume, search]);

  // --- deep link /jobs/:jobId ---------------------------------------------------------
  useEffect(() => {
    if (!jobId) return;
    selectJob(jobId);
    setSheetOpen(true);
    const known = useJobStore.getState().jobsById[jobId] ?? useJobStore.getState().tracked[jobId]?.job;
    if (known) {
      setDeepState('idle');
      return;
    }
    let cancelled = false;
    setDeepState('loading');
    api
      .getJob(jobId)
      .then((job) => {
        if (cancelled) return;
        setDeepJob(job);
        setDeepState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setDeepJob(null);
        setDeepState('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, selectJob]);

  // --- derived data -------------------------------------------------------------------
  const jobs = useMemo(() => results?.jobs ?? [], [results]);
  const broadJobs = useMemo(() => results?.near?.broad ?? [], [results]);

  const sortedJobs = useMemo(() => {
    if (sort === 'date') {
      return [...jobs].sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''));
    }
    return jobs;
  }, [jobs, sort]);

  const selectedJob: Job | undefined = useMemo(() => {
    if (!selectedJobId) return undefined;
    return jobsById[selectedJobId] ?? tracked[selectedJobId]?.job ?? (deepJob?.id === selectedJobId ? deepJob : undefined);
  }, [selectedJobId, jobsById, tracked, deepJob]);

  const matchTargets = useMemo(() => {
    const all = broadJobs.length > 0 ? [...sortedJobs, ...broadJobs] : sortedJobs;
    if (selectedJob && !all.some((j) => j.id === selectedJob.id)) return [...all, selectedJob];
    return all;
  }, [sortedJobs, broadJobs, selectedJob]);

  const matches = useJobMatches(matchTargets, resume);

  const displayJobs = useMemo(() => {
    if (sort !== 'match' || matches.size === 0) return sortedJobs;
    return [...sortedJobs].sort((a, b) => (matches.get(b.id)?.score ?? -1) - (matches.get(a.id)?.score ?? -1));
  }, [sortedJobs, sort, matches]);

  const savedIds = useMemo(() => new Set(Object.keys(tracked)), [tracked]);
  const appliedIds = useMemo(
    () => new Set(Object.values(tracked).filter((t) => t.status === 'applied').map((t) => t.job.id)),
    [tracked],
  );

  const unavailableSources = useMemo<JobSource[]>(
    () => (health?.sources ?? []).filter((s) => !s.enabled).map((s) => s.source),
    [health],
  );
  // Adzuna and Google Jobs are where on-site US listings come from; the keyless boards are mostly remote.
  const localSourceMissing = unavailableSources.includes('adzuna') && unavailableSources.includes('jsearch');

  // --- actions -------------------------------------------------------------------------
  const scrollToResults = useCallback(() => {
    if (typeof document === 'undefined') return;
    const node = resultsTop.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'start' });
      return;
    }
    const scroller = document.scrollingElement ?? document.documentElement;
    if (scroller) scroller.scrollTop = 0;
  }, []);

  const runSearch = useCallback(
    (patch: Partial<JobSearchQuery>) => {
      const next = { ...patch, page: patch.page ?? 1 };
      // The first ZIP he searches becomes home; after that, home changes only when he says so.
      const location = (next.location ?? '').trim();
      if (isZipLocation(location) && !useSettingsStore.getState().homeZip) setHomeZip(location);
      void search(next);
    },
    [search, setHomeZip],
  );

  const changeFilters = useCallback(
    (patch: Partial<JobSearchQuery>) => {
      // "Nearest" has no meaning once the radius controls go away.
      if (patch.remoteOnly && sort === 'distance') {
        setSort('relevance');
        runSearch({ ...patch, sort: 'relevance' });
        return;
      }
      runSearch(patch);
    },
    [runSearch, sort],
  );

  const submitSearch = useCallback(() => {
    setHeadlineSearch(null);
    const location = draft.location.trim();
    // "Nearest" means nothing without a ZIP; fall back rather than leave a dead sort selected.
    if (sort === 'distance' && !isZipLocation(location)) {
      setSort('relevance');
      runSearch({ q: draft.q.trim(), location, sort: 'relevance' });
      return;
    }
    runSearch({ q: draft.q.trim(), location });
  }, [draft, runSearch, sort]);

  const clearHeadlineSearch = useCallback(() => {
    setHeadlineSearch(null);
    setDraft({ q: '', location: '' });
    useJobStore.setState({ results: null, error: null, selectedJobId: null });
    useJobStore.getState().setQuery({ q: '', page: 1 });
  }, []);

  const handleSort = useCallback(
    (next: SortMode) => {
      setSort(next);
      const wanted: JobSearchQuery['sort'] = next === 'date' ? 'date' : next === 'distance' ? 'distance' : 'relevance';
      if (query.sort !== wanted) runSearch({ sort: wanted });
    },
    [query.sort, runSearch],
  );

  const openJob = useCallback(
    (job: Job) => {
      selectJob(job.id);
      setSheetOpen(true);
    },
    [selectJob],
  );

  const toggleSave = useCallback(
    (job: Job) => {
      if (useJobStore.getState().tracked[job.id]) {
        untrackJob(job.id);
        toast.push({ title: 'Removed from saved jobs', tone: 'info' });
        return;
      }
      trackJob(job, 'saved', resume?.id);
      toast.push({ title: `Saved “${job.title}”`, tone: 'success' });
    },
    [resume?.id, toast, trackJob, untrackJob],
  );

  const markApplied = useCallback(
    (job: Job) => {
      trackJob(job, 'applied', resume?.id);
      toast.push({ title: 'Marked as applied', description: 'Track the rest in the Tracker.', tone: 'success' });
    },
    [resume?.id, toast, trackJob],
  );

  const runSavedSearch = useCallback(
    (saved: SavedSearch) => {
      setHeadlineSearch(null);
      setSort(
        saved.query.sort === 'date'
          ? 'date'
          : saved.query.sort === 'distance' && isZipLocation(saved.query.location)
            ? 'distance'
            : 'relevance',
      );
      void search({ ...saved.query, page: 1 });
      scrollToResults();
    },
    [scrollToResults, search],
  );

  // Desktop: keep a posting open next to the list so the panel is never empty.
  useEffect(() => {
    if (!isWide || selectedJobId || displayJobs.length === 0) return;
    const first = displayJobs[0];
    if (first) selectJob(first.id);
  }, [isWide, selectedJobId, displayJobs, selectJob]);

  // --- render helpers -------------------------------------------------------------------
  const hasSearched = Boolean(results) || loading || Boolean(error);
  const total = results?.total ?? 0;

  const emptyPrompt =
    !hasSearched && !query.q.trim() ? (
      <EmptyState
        art="compass"
        title="Search thousands of openings at once"
        description="One search hits every job board we can reach and scores each posting against your resume."
        actions={
          <div className="jf-examples">
            {EXAMPLE_SEARCHES.map((example) => (
              <Button
                key={example}
                size="sm"
                onClick={() => {
                  setDraft({ q: example, location: draft.location });
                  runSearch({ q: example });
                }}
              >
                {example}
              </Button>
            ))}
          </div>
        }
      />
    ) : (
      <EmptyState
        icon={<SearchX size={20} />}
        title="No jobs matched those filters"
        description={
          isZipLocation(query.location)
            ? 'Try a wider radius, fewer keywords, or turn Include remote back on.'
            : 'Try fewer keywords, widen the posted-within window, or turn off Remote only.'
        }
      />
    );

  const detail = selectedJob ? (
    <JobDetail key={selectedJob.id} job={selectedJob} match={matches.get(selectedJob.id)} />
  ) : deepState === 'loading' ? (
    <div className="jf-detail" aria-busy="true">
      <Skeleton width="70%" height={20} />
      <Skeleton width="40%" height={13} />
      <Skeleton width="100%" height={120} />
    </div>
  ) : deepState === 'missing' ? (
    <div className="jf-detail">
      <EmptyState
        plain
        icon={<SearchX size={20} />}
        title="This posting is no longer available"
        description="Job boards drop listings once they are filled or expire. Try searching for the role again."
      />
    </div>
  ) : (
    <div className="jf-detail">
      <EmptyState
        plain
        size="sm"
        icon={<FileText size={20} />}
        title="Pick a job to see the details"
        description="The full description, your match breakdown and the apply link show up here."
      />
    </div>
  );

  return (
    <div className="jf-page">
      <PageHeader
        title="Job finder"
        eyebrow="Search"
        description="Aggregated from every job board we can reach, scored against your resume."
        badge={results ? <Badge tone="accent">{total.toLocaleString('en-US')} results</Badge> : undefined}
      />

      <SearchBar
        keywords={draft.q}
        location={draft.location}
        loading={loading}
        onKeywordsChange={(q) => setDraft((d) => ({ ...d, q }))}
        onLocationChange={(location) => setDraft((d) => ({ ...d, location }))}
        onSubmit={submitSearch}
      />

      <FiltersBar
        query={query}
        sort={sort}
        matchAvailable={Boolean(resume)}
        unavailableSources={unavailableSources}
        homeZip={homeZip}
        onChange={changeFilters}
        onSortChange={handleSort}
      />

      <SavedSearches
        searches={savedSearches}
        currentQuery={query}
        onRun={runSavedSearch}
        onDelete={deleteSavedSearch}
        onSave={saveSearch}
      />

      {headlineSearch ? (
        <div className="jf-banner jf-banner--muted">
          <span className="jf-banner__text">
            Showing matches for <strong>{headlineSearch}</strong> — the headline on your resume.
          </span>
          <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={clearHeadlineSearch}>
            Clear
          </Button>
        </div>
      ) : null}

      {results?.near ? (
        <div className="jf-banner jf-banner--muted" data-testid="near-banner">
          <MapPin size={15} aria-hidden="true" />
          <span className="jf-banner__text">
            {results.near.remoteOnly ? (
              <>
                Remote roles open to someone in <strong>{results.near.label}</strong> ({results.near.zip}).
              </>
            ) : (
              <>
                Within <strong>{results.near.radiusMiles} miles</strong> of {results.near.zip} ({results.near.label})
                {results.near.includeRemote ? ', plus remote roles' : ''}.
              </>
            )}
            {!results.near.remoteOnly && results.near.unplaced > 0 ? (
              <span className="jf-near__detail small">
                {results.near.unplaced} on-site {results.near.unplaced === 1 ? 'posting only says' : 'postings only say'}{' '}
                {results.near.state ? `"${stateName(results.near.state)}" or "USA"` : '"USA"'}, so{' '}
                {results.near.unplaced === 1 ? "it's" : "they're"} listed in their own group below the results.
              </span>
            ) : null}
            {homeZip === results.near.zip ? (
              <span className="jf-near__detail small">This is your home ZIP.</span>
            ) : (
              <span className="jf-near__detail small">
                <button type="button" className="jf-linkbtn" onClick={() => setHomeZip(results.near!.zip)}>
                  Make {results.near.zip} my home ZIP
                </button>
              </span>
            )}
            {localSourceMissing ? (
              <span className="jf-near__detail small">
                Most local, on-site listings come from Adzuna and Google Jobs (which includes Indeed), and neither is
                connected on this server yet. Until one is, expect mostly remote roles.
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      {!resume && results ? (
        <div className="jf-banner">
          <span className="jf-banner__text">Create a resume to see how well you match each of these jobs.</span>
          <Link className="ui-btn ui-btn--primary ui-btn--sm" to="/resume">
            Build a resume
          </Link>
        </div>
      ) : null}

      {results ? <SourceStatusStrip sources={results.sources} /> : null}

      <div ref={resultsTop} />

      {results && !loading ? (
        <div className="jf-meta">
          <span className="jf-meta__count">{rangeLabel(results.page, results.pageSize, total, displayJobs.length)}</span>
          {results.cached ? (
            <Badge tone="neutral" variant="outline" title="Served from the server cache">
              cached
            </Badge>
          ) : null}
          {sort === 'match' ? <span className="small subtle">Sorted by resume match</span> : null}
          {sort === 'distance' && results.near ? <span className="small subtle">Nearest first</span> : null}
        </div>
      ) : null}

      <div className={isWide ? 'jf-body jf-body--split' : 'jf-body'}>
        <div className="jf-results">
          <JobList
            jobs={displayJobs}
            matches={matches}
            loading={loading}
            error={error}
            selectedJobId={selectedJobId}
            savedIds={savedIds}
            appliedIds={appliedIds}
            emptyState={emptyPrompt}
            onOpen={openJob}
            onSelect={(job) => selectJob(job.id)}
            onToggleSave={toggleSave}
            onMarkApplied={markApplied}
            onRetry={() => runSearch({ page: results?.page ?? 1 })}
          />

          {broadJobs.length > 0 ? (
            <BroadGroups
              jobs={broadJobs}
              total={results?.near?.unplaced ?? broadJobs.length}
              state={results?.near?.state}
              render={(group) => (
                <JobList
                  jobs={group}
                  matches={matches}
                  loading={false}
                  error={null}
                  selectedJobId={selectedJobId}
                  savedIds={savedIds}
                  appliedIds={appliedIds}
                  emptyState={null}
                  onOpen={openJob}
                  onSelect={(job) => selectJob(job.id)}
                  onToggleSave={toggleSave}
                  onMarkApplied={markApplied}
                  onRetry={() => undefined}
                />
              )}
            />
          ) : null}

          {results ? (
            <Pagination
              page={results.page}
              pageSize={results.pageSize}
              total={total}
              disabled={loading}
              onChange={(page) => {
                void search({ page });
                scrollToResults();
              }}
            />
          ) : null}
        </div>

        {isWide ? (
          <aside className="jf-detail-col" aria-label="Job details">
            {detail}
          </aside>
        ) : null}
      </div>

      {!isWide ? (
        <Drawer
          open={sheetOpen && (Boolean(selectedJob) || deepState !== 'idle')}
          onClose={() => setSheetOpen(false)}
          side="bottom"
          size="88vh"
          title="Job details"
        >
          {selectedJob ? (
            <JobDetail
              key={selectedJob.id}
              bare
              job={selectedJob}
              match={matches.get(selectedJob.id)}
              onBack={() => setSheetOpen(false)}
            />
          ) : (
            detail
          )}
        </Drawer>
      ) : null}

      <p className="visually-hidden" aria-live="polite">
        {loading ? 'Searching job boards…' : results ? `${total} jobs found` : ''}
      </p>
    </div>
  );
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};

function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}

type BroadJob = NonNullable<JobSearchResponse['near']>['broad'][number];

/** Postings that only name his state or the country: real jobs, just not measurable, so never mixed into the radius list. */
function BroadGroups({
  jobs,
  total,
  state,
  render,
}: {
  jobs: BroadJob[];
  total: number;
  state?: string;
  render: (group: Job[]) => ReactNode;
}) {
  const inState = jobs.filter((job) => job.area === 'state');
  const national = jobs.filter((job) => job.area === 'country');
  const more = total - jobs.length;
  return (
    <section className="jf-broad" aria-label="Postings without a city" data-testid="broad-groups">
      {inState.length > 0 ? (
        <div className="jf-broad__group">
          <h2 className="jf-broad__title">Somewhere in {state ? stateName(state) : 'your state'}</h2>
          <p className="small subtle">These only say the state, so we can't tell how far they are. Check the posting.</p>
          {render(inState)}
        </div>
      ) : null}
      {national.length > 0 ? (
        <div className="jf-broad__group">
          <h2 className="jf-broad__title">Only says "USA"</h2>
          <p className="small subtle">No city or state given. Often a travelling or multi-site role.</p>
          {render(national)}
        </div>
      ) : null}
      {more > 0 ? <p className="small subtle">{more} more like these weren't shown.</p> : null}
    </section>
  );
}
