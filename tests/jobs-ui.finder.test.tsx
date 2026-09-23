// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Job, JobSearchResponse } from '@shared/types';
import { scoreJobMatch } from '@shared/match';
import { ToastProvider } from '@/components/ui';
import { DEFAULT_QUERY, useJobStore } from '@/stores/jobStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createSampleResume } from '@/lib/resume/defaults';
import { resumeProfile } from '@/lib/resume/profile';
import { sanitizeJobHtml } from '@/components/jobs';
import JobFinderPage from '@/pages/JobFinder';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeJob(partial: Partial<Job> & Pick<Job, 'id' | 'title' | 'company'>): Job {
  return {
    source: 'remotive',
    sourceId: partial.id.split(':')[1] ?? partial.id,
    location: 'Remote — US',
    remote: true,
    tags: [],
    descriptionHtml: '',
    descriptionText: '',
    url: `https://example.com/${partial.id}`,
    postedAt: '2026-03-08T09:00:00.000Z',
    fetchedAt: '2026-03-10T09:00:00.000Z',
    ...partial,
  };
}

const REACT_JOB = makeJob({
  id: 'remotive:1',
  sourceId: '1',
  title: 'Senior React Engineer',
  company: 'Northwind Labs',
  tags: ['react', 'typescript', 'graphql', 'aws', 'jest'],
  salary: { min: 150000, max: 185000, currency: 'USD', period: 'year' },
  descriptionHtml:
    '<p>We need a senior engineer.</p><script>window.__pwned = true;</script><p>Required: React, TypeScript, Node.js and AWS.</p><a href="https://example.com/apply">Apply here</a>',
  descriptionText: 'We need a senior engineer. Required: React, TypeScript, Node.js and AWS.',
});

const SUPPORT_JOB = makeJob({
  id: 'arbeitnow:2',
  source: 'arbeitnow',
  sourceId: '2',
  title: 'Customer Support Specialist',
  company: 'Brightline',
  location: 'Berlin, Germany',
  remote: false,
  tags: ['zendesk', 'support'],
  postedAt: '2026-03-01T09:00:00.000Z',
  descriptionText: 'Handle customer tickets in Zendesk. Required: Zendesk, Salesforce and empathy.',
});

const MARKETING_JOB = makeJob({
  id: 'themuse:3',
  source: 'themuse',
  sourceId: '3',
  title: 'Marketing Operations Manager',
  company: 'Cascade Partners',
  location: 'Austin, TX',
  remote: false,
  tags: ['hubspot', 'salesforce', 'marketing automation'],
  postedAt: '2026-03-09T09:00:00.000Z',
  descriptionText:
    'Own the marketing automation stack. Required: HubSpot, Salesforce, SQL, lead scoring and campaign reporting.',
});

const RESPONSE: JobSearchResponse = {
  jobs: [REACT_JOB, SUPPORT_JOB, MARKETING_JOB],
  total: 3,
  page: 1,
  pageSize: 25,
  sources: [
    { source: 'remotive', status: 'ok', count: 1, ms: 240 },
    { source: 'arbeitnow', status: 'ok', count: 1, ms: 310 },
    { source: 'themuse', status: 'ok', count: 1, ms: 190 },
    { source: 'remoteok', status: 'error', count: 0, ms: 8000, error: 'Upstream returned 503' },
    { source: 'adzuna', status: 'disabled', count: 0, ms: 0 },
  ],
  cached: false,
  fetchedAt: '2026-03-10T09:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(searchBody: JobSearchResponse | null = RESPONSE) {
  fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/api/jobs/search')) {
      if (!searchBody) return jsonResponse({ error: 'Search failed', code: 'upstream' }, 502);
      return jsonResponse(searchBody);
    }
    if (url.includes('/api/jobs/')) {
      const id = decodeURIComponent(url.split('/api/jobs/')[1] ?? '');
      const job = RESPONSE.jobs.find((j) => j.id === id);
      return job ? jsonResponse(job) : jsonResponse({ error: 'Not found', code: 'not_found' }, 404);
    }
    return jsonResponse({ error: 'Unhandled', code: 'unhandled' }, 404);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

/** Desktop viewport by default so the detail panel renders inline. */
function stubMatchMedia(wide = true) {
  window.matchMedia = ((query: string) => ({
    matches: wide ? /min-width:\s*(1024|1100)px/.test(query) : /max-width:\s*767px/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderPage(options: { q?: string; path?: string } = {}) {
  const { q = 'react', path = '/jobs' } = options;
  useJobStore.setState({ query: { ...DEFAULT_QUERY, q } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/jobs" element={<JobFinderPage />} />
          <Route path="/jobs/:jobId" element={<JobFinderPage />} />
          <Route path="/tailor/:jobId" element={<p>Tailor page</p>} />
          <Route path="/resume" element={<p>Resume page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function cardTitles(): string[] {
  return screen
    .getAllByTestId('job-card')
    .map((card) => within(card).getByRole('button', { name: /Engineer|Specialist|Manager/ }).textContent ?? '');
}

beforeEach(() => {
  stubMatchMedia(true);
  stubFetch();
  useJobStore.setState({
    query: { ...DEFAULT_QUERY },
    results: null,
    loading: false,
    error: null,
    selectedJobId: null,
    jobsById: {},
    tracked: {},
    savedSearches: [],
  });
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useSettingsStore.setState({ homeZip: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobFinder results', () => {
  it('renders every result plus the source status strip', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'Senior React Engineer' });
    expect(screen.getAllByTestId('job-card')).toHaveLength(3);
    expect(screen.getByText('3 jobs')).toBeTruthy();

    const pills = screen.getAllByTestId('source-pill');
    expect(pills).toHaveLength(5);
    expect(screen.getByText('3 of 5 boards responded')).toBeTruthy();

    const failed = pills.find((p) => p.getAttribute('data-source') === 'remoteok');
    expect(failed?.getAttribute('data-status')).toBe('error');
    expect(failed?.textContent).toContain('Upstream returned 503');

    const disabled = pills.find((p) => p.getAttribute('data-source') === 'adzuna');
    expect(disabled?.textContent).toContain('Needs API key');
  });

  it('shows salary, source badge and relative posting age on a card', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    const card = screen.getAllByTestId('job-card')[0]!;
    expect(within(card).getByText('$150k – $185k/yr')).toBeTruthy();
    expect(within(card).getByText('Remotive')).toBeTruthy();
    expect(within(card).getByText('Remote')).toBeTruthy();
  });
});

describe('JobFinder detail panel', () => {
  it('opens the clicked job and strips scripts from the description', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Customer Support Specialist' });

    fireEvent.click(screen.getByRole('button', { name: 'Customer Support Specialist' }));

    const panel = await screen.findByLabelText('Customer Support Specialist at Brightline');
    expect(within(panel).getByText(/Handle customer tickets in Zendesk/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Senior React Engineer' }));
    const reactPanel = await screen.findByLabelText('Senior React Engineer at Northwind Labs');

    const description = within(reactPanel).getByTestId('job-description');
    expect(description.innerHTML).not.toContain('<script');
    expect(description.innerHTML).toContain('We need a senior engineer.');
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();

    const link = description.querySelector('a');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('target')).toBe('_blank');

    const apply = within(reactPanel).getByRole('link', { name: /Apply on Remotive/ });
    expect(apply.getAttribute('href')).toBe('https://example.com/remotive:1');
    expect(apply.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('sanitizes iframes, styles and javascript: urls', () => {
    const dirty =
      '<p>Hi</p><style>body{display:none}</style><iframe src="https://evil.test"></iframe>' +
      '<a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)">';
    const clean = sanitizeJobHtml(dirty);
    expect(clean).toContain('<p>Hi</p>');
    expect(clean).not.toContain('<style');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<img');
    expect(clean.toLowerCase()).not.toContain('javascript:');
    expect(sanitizeJobHtml('')).toBe('');
  });

  it('shows a friendly message for a deep link to a posting that is gone', async () => {
    renderPage({ path: '/jobs/remotive:404', q: '' });
    expect(await screen.findByText('This posting is no longer available')).toBeTruthy();
  });
});

describe('JobFinder tracking', () => {
  it('saves and unsaves a job through the card action', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });

    const card = screen.getAllByTestId('job-card')[0]!;
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(useJobStore.getState().tracked['remotive:1']?.status).toBe('saved');
    });
    expect(within(screen.getAllByTestId('job-card')[0]!).getByRole('button', { name: 'Saved' })).toBeTruthy();

    fireEvent.click(within(screen.getAllByTestId('job-card')[0]!).getByRole('button', { name: 'Saved' }));
    await waitFor(() => {
      expect(useJobStore.getState().tracked['remotive:1']).toBeUndefined();
    });
  });

  it('marks a job applied from the card', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Marketing Operations Manager' });

    const card = screen.getAllByTestId('job-card')[2]!;
    fireEvent.click(within(card).getByRole('button', { name: 'Mark applied' }));

    await waitFor(() => {
      expect(useJobStore.getState().tracked['themuse:3']?.status).toBe('applied');
    });
  });
});

describe('JobFinder sorting', () => {
  it('orders results by score when best match is chosen and a resume exists', async () => {
    const resume = createSampleResume();
    useResumeStore.setState({ resumes: { [resume.id]: resume }, activeResumeId: resume.id });

    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });

    // Relevance keeps the server's order.
    expect(cardTitles()).toEqual([
      'Senior React Engineer',
      'Customer Support Specialist',
      'Marketing Operations Manager',
    ]);

    const profile = resumeProfile(resume);
    const expected = [...RESPONSE.jobs]
      .sort((a, b) => scoreJobMatch(profile, b).score - scoreJobMatch(profile, a).score)
      .map((j) => j.title);

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'match' } });

    await waitFor(() => {
      expect(cardTitles()).toEqual(expected);
    });
    expect(screen.getByText('Sorted by resume match')).toBeTruthy();
  });

  it('orders results by posted date when newest is chosen', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'date' } });

    await waitFor(() => {
      expect(cardTitles()).toEqual([
        'Marketing Operations Manager',
        'Senior React Engineer',
        'Customer Support Specialist',
      ]);
    });
  });

  it('disables best match until a resume exists', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    const option = within(screen.getByLabelText('Sort') as HTMLSelectElement).getByRole('option', {
      name: /Best match/,
    }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });
});

describe('JobFinder empty and error states', () => {
  it('prompts with example searches before anything has been searched', async () => {
    renderPage({ q: '' });

    expect(await screen.findByText('Search thousands of openings at once')).toBeTruthy();
    expect(screen.queryAllByTestId('job-card')).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'React developer' }));
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('reports an empty result set', async () => {
    stubFetch({ ...RESPONSE, jobs: [], total: 0 });
    renderPage({ q: 'underwater basket weaving' });

    expect(await screen.findByText('No jobs matched those filters')).toBeTruthy();
  });

  it('shows the error state with a retry that searches again', async () => {
    stubFetch(null);
    renderPage();

    expect(await screen.findByText('That search could not be completed')).toBeTruthy();
    const callsBefore = fetchMock.mock.calls.length;

    stubFetch();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(callsBefore).toBeGreaterThan(0);
  });
});

describe('JobFinder search and saved searches', () => {
  it('runs the typed query and keeps it in the store', async () => {
    renderPage({ q: '' });
    await screen.findByText('Search thousands of openings at once');

    fireEvent.change(screen.getByLabelText('Job title, skill or company'), { target: { value: 'marketing ops' } });
    fireEvent.change(screen.getByLabelText('City, state or ZIP code'), { target: { value: 'Austin, TX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByRole('button', { name: 'Senior React Engineer' });
    expect(useJobStore.getState().query.q).toBe('marketing ops');
    expect(useJobStore.getState().query.location).toBe('Austin, TX');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('q=marketing+ops');
  });

  it('saves the current search and runs it again from the chip', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });

    fireEvent.click(screen.getByRole('button', { name: 'Save this search' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(useJobStore.getState().savedSearches).toHaveLength(1);
    });
    expect(useJobStore.getState().savedSearches[0]?.name).toBe('react');

    const chip = await screen.findByRole('button', { name: 'react' });
    fireEvent.click(chip);
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved search react' }));
    await waitFor(() => {
      expect(useJobStore.getState().savedSearches).toHaveLength(0);
    });
  });
});

describe('JobFinder keyboard and layout', () => {
  it('moves the selection with the arrow keys', async () => {
    renderPage();
    const first = await screen.findByRole('button', { name: 'Senior React Engineer' });
    const second = screen.getByRole('button', { name: 'Customer Support Specialist' });

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(document.activeElement).toBe(second);
    });
    expect(useJobStore.getState().selectedJobId).toBe('arbeitnow:2');

    fireEvent.keyDown(second, { key: 'ArrowUp' });
    await waitFor(() => {
      expect(useJobStore.getState().selectedJobId).toBe('remotive:1');
    });
  });

  it('opens the detail in a sheet below 1024px', async () => {
    stubMatchMedia(false);
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Marketing Operations Manager' }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByLabelText('Marketing Operations Manager at Cascade Partners')).toBeTruthy();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Back to results' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('pages through results and asks the server for the next page', async () => {
    stubFetch({ ...RESPONSE, total: 60 });
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    expect(screen.getByText('1–3 of 60 jobs')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('page=2');
    });
  });
});

describe('JobFinder match explanation', () => {
  it('adds a missing skill to the resume from the detail panel', async () => {
    const resume = createSampleResume();
    useResumeStore.setState({ resumes: { [resume.id]: resume }, activeResumeId: resume.id });

    renderPage();
    await screen.findByRole('button', { name: 'Customer Support Specialist' });
    fireEvent.click(screen.getByRole('button', { name: 'Customer Support Specialist' }));

    const panel = await screen.findByLabelText('Customer Support Specialist at Brightline');
    const addButtons = within(panel).getAllByRole('button', { name: /^Add .* to your skills$/ });
    expect(addButtons.length).toBeGreaterThan(0);

    const first = addButtons[0]!;
    const skill = (first.textContent ?? '').trim();
    fireEvent.click(first);

    await waitFor(() => {
      const updated = useResumeStore.getState().resumes[resume.id]!;
      expect(updated.skillGroups[0]?.skills.some((s) => s.toLowerCase() === skill.toLowerCase())).toBe(true);
    });
  });

  it('invites the user to build a resume when none exists', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    expect(screen.getAllByText(/Create a resume to see how well you match/).length).toBeGreaterThan(0);
  });
});

describe('JobFinder ZIP radius', () => {
  const NEAR_RESPONSE: JobSearchResponse = {
    ...RESPONSE,
    jobs: [{ ...MARKETING_JOB, distanceMiles: 6.24 }, REACT_JOB],
    total: 2,
    near: {
      zip: '78746',
      label: 'West Lake Hills, TX',
      state: 'TX',
      radiusMiles: 25,
      includeRemote: true,
      unplaced: 2,
      broad: [
        { ...MARKETING_JOB, id: 'broad-tx', title: 'Statewide Field Marketer', location: 'Texas', area: 'state' },
        { ...REACT_JOB, id: 'broad-us', title: 'Traveling Support Tech', location: 'USA', remote: false, area: 'country' },
      ],
    },
  };

  async function searchZip() {
    stubFetch(NEAR_RESPONSE);
    renderPage({ q: '' });
    await screen.findByText('Search thousands of openings at once');
    fireEvent.change(screen.getByLabelText('City, state or ZIP code'), { target: { value: '78746' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('button', { name: 'Marketing Operations Manager' });
  }

  it('says what radius it searched and how many postings it could not place', async () => {
    await searchZip();
    const banner = screen.getByTestId('near-banner');
    expect(banner.textContent).toMatch(/Within 25 miles of 78746 \(West Lake Hills, TX\), plus remote roles/);
    expect(banner.textContent).toMatch(/2 on-site postings only say "Texas" or "USA"/);
  });

  it('lists "Texas" and "USA" postings in their own groups under the results', async () => {
    await searchZip();
    const groups = screen.getByTestId('broad-groups');
    expect(within(groups).getByRole('heading', { name: 'Somewhere in Texas' })).toBeTruthy();
    expect(within(groups).getByRole('heading', { name: 'Only says "USA"' })).toBeTruthy();
    expect(within(groups).getByRole('button', { name: 'Statewide Field Marketer' })).toBeTruthy();
    expect(within(groups).getByRole('button', { name: 'Traveling Support Tech' })).toBeTruthy();
  });

  it('remembers the first ZIP as home and offers it back when searching elsewhere', async () => {
    await searchZip();
    expect(useSettingsStore.getState().homeZip).toBe('78746');
    expect(screen.getByTestId('near-banner').textContent).toContain('This is your home ZIP.');
    fireEvent.change(screen.getByLabelText('City, state or ZIP code'), { target: { value: 'Dallas, TX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('location=Dallas'));
    fireEvent.click(await screen.findByRole('button', { name: /Near home · 78746/ }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('location=78746'));
  });

  it('starts from the home ZIP when the location box is empty', async () => {
    useSettingsStore.setState({ homeZip: '75501' });
    renderPage({ q: 'react' });
    expect((screen.getByLabelText('City, state or ZIP code') as HTMLInputElement).value).toBe('75501');
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('location=75501'));
  });

  it('hides the radius controls when Remote only is on', async () => {
    await searchZip();
    expect(screen.getByLabelText('Within')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remote only' }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('remoteOnly=true'));
    expect(screen.queryByLabelText('Within')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Include remote' })).toBeNull();
  });

  it('shows the distance on a card that has one, and nothing on one that does not', async () => {
    await searchZip();
    const [local, remote] = screen.getAllByTestId('job-card');
    expect(local!.textContent).toContain('6.2 mi');
    expect(remote!.textContent).not.toMatch(/\bmi\b/);
  });

  it('offers a radius and include-remote only once a ZIP is searched', async () => {
    renderPage({ q: 'react' });
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    expect(screen.queryByLabelText('Within')).toBeNull();
    cleanup();
    useJobStore.setState({ results: null });

    await searchZip();
    fireEvent.change(screen.getByLabelText('Within'), { target: { value: '50' } });
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('radiusMiles=50'));

    fireEvent.click(screen.getByRole('button', { name: 'Include remote' }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('includeRemote=false'));
  });

  it('sorts nearest first on the server when Nearest is chosen', async () => {
    await searchZip();
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'distance' } });
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('sort=distance'));
  });

  it('disables Nearest until there is a ZIP', async () => {
    renderPage({ q: 'react' });
    await screen.findByRole('button', { name: 'Senior React Engineer' });
    const option = screen.getByRole('option', { name: /Nearest/ }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });
});
