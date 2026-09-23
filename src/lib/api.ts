/**
 * Typed client for the API server. All functions throw `ApiClientError` on non-2xx.
 * In dev, Vite proxies /api to the server on :8787; in production the same Express app serves both.
 */
import type {
  AiCoverLetterRequest,
  AiCoverLetterResponse,
  AiImproveBulletRequest,
  AiImproveBulletResponse,
  AiParseResumeRequest,
  AiParseResumeResponse,
  AiPolishRequest,
  AiPolishResponse,
  AiStatus,
  AiSummaryRequest,
  AiSummaryResponse,
  AiTailorRequest,
  AiTailorResponse,
  HealthResponse,
  Job,
  JobSearchQuery,
  JobSearchResponse,
} from '@shared/types';

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 45_000);
  try {
    const res = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: text };
    }
    if (!res.ok) {
      const err = (body ?? {}) as { error?: string; code?: string; details?: unknown };
      throw new ApiClientError(err.error || `Request failed (${res.status})`, res.status, err.code, err.details);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiClientError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiClientError('Request timed out', 0, 'timeout');
    throw new ApiClientError((e as Error).message || 'Network error', 0, 'network');
  } finally {
    clearTimeout(timeout);
  }
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  health: () => request<HealthResponse>('/api/health', { timeoutMs: 10_000 }),

  searchJobs: (query: JobSearchQuery) =>
    request<JobSearchResponse>(`/api/jobs/search${qs({ ...query, sources: query.sources })}`, { timeoutMs: 60_000 }),

  getJob: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),

  ai: {
    status: () => request<AiStatus>('/api/ai/status', { timeoutMs: 10_000 }),
    improveBullet: (body: AiImproveBulletRequest) =>
      request<AiImproveBulletResponse>('/api/ai/improve-bullet', { method: 'POST', body: JSON.stringify(body), timeoutMs: 90_000 }),
    summary: (body: AiSummaryRequest) =>
      request<AiSummaryResponse>('/api/ai/summary', { method: 'POST', body: JSON.stringify(body), timeoutMs: 90_000 }),
    tailor: (body: AiTailorRequest) =>
      request<AiTailorResponse>('/api/ai/tailor', { method: 'POST', body: JSON.stringify(body), timeoutMs: 180_000 }),
    coverLetter: (body: AiCoverLetterRequest) =>
      request<AiCoverLetterResponse>('/api/ai/cover-letter', { method: 'POST', body: JSON.stringify(body), timeoutMs: 180_000 }),
    polish: (body: AiPolishRequest) =>
      request<AiPolishResponse>('/api/ai/polish', { method: 'POST', body: JSON.stringify(body), timeoutMs: 45_000 }),
    parseResume: (body: AiParseResumeRequest) =>
      request<AiParseResumeResponse>('/api/ai/parse-resume', { method: 'POST', body: JSON.stringify(body), timeoutMs: 180_000 }),
  },
};
