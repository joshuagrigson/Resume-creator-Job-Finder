/**
 * ZIP-radius search: turn a 5-digit ZIP into a centre point, then keep only postings whose
 * location lands within the radius (plus remote roles, unless the searcher opts out).
 */
import type { Job, JobSearchQuery, NearSummary } from '../../shared/types';
import {
  anchorCity,
  broadArea,
  haversineMiles,
  isZip,
  mentionsUS,
  nearestPlace,
  remoteOpenToUS,
  resolveLocation,
  titleCase,
  zipPoint,
  type GeoPoint,
} from '../geo/index';

export const DEFAULT_RADIUS_MILES = 25;
export const MAX_RADIUS_MILES = 200;

/** The ZIP isn't in the Census table (PO-box-only ZIPs aren't) — the route turns this into a 400. */
export class UnknownZipError extends Error {
  readonly zip: string;
  constructor(zip: string) {
    super(`We don't recognise ZIP ${zip}. PO-box-only ZIPs aren't mapped — try the ZIP where you live.`);
    this.name = 'UnknownZipError';
    this.zip = zip;
  }
}

export interface NearContext {
  zip: string;
  center: GeoPoint;
  /** "West Lake Hills, TX" — the ZIP's own town; shown to the user and sent to radius-aware boards. */
  label: string;
  /** "Austin, TX" — the biggest city in range; sent to boards that filter by city name only. */
  metro: string;
  radiusMiles: number;
  includeRemote: boolean;
  /** Two-letter state of the ZIP ("TX"); null if the ZIP has no named place nearby. */
  state: string | null;
  /** "Remote only" is on: remote roles always count and nothing on-site is measured. */
  remoteOnly: boolean;
}

/** Radius mode when `location` is a ZIP; `null` for every other search. */
export function resolveNear(query: JobSearchQuery): NearContext | null {
  const zip = query.location?.trim();
  if (!isZip(zip)) return null;
  const center = zipPoint(zip);
  if (!center) throw new UnknownZipError(zip);

  const place = nearestPlace(center);
  const radius = Number(query.radiusMiles);
  const radiusMiles = Number.isFinite(radius) && radius > 0 ? Math.min(MAX_RADIUS_MILES, radius) : DEFAULT_RADIUS_MILES;
  const label = place ? `${titleCase(place.name)}, ${place.state}` : zip;
  const anchor = anchorCity(center, radiusMiles);
  return {
    zip,
    center,
    label,
    metro: anchor ? `${titleCase(anchor.name)}, ${anchor.state}` : label,
    radiusMiles,
    // With "Remote only" the radius controls are hidden, so a stale "Include remote: off" must not empty the list.
    includeRemote: query.remoteOnly ? true : query.includeRemote !== false,
    state: place?.state ?? null,
    remoteOnly: Boolean(query.remoteOnly),
  };
}

/** Nearest of a job's locations to the centre, in miles; `null` when none can be placed. */
export function distanceTo(job: Job, center: GeoPoint): number | null {
  const points = job.geo && job.geo.length > 0 ? job.geo : resolveLocation(job.location);
  let best: number | null = null;
  for (const point of points) {
    const d = haversineMiles(center, point);
    if (best === null || d < best) best = d;
  }
  return best;
}

/**
 * Keep jobs within the radius (stamped with `distanceMiles`) and, when allowed, remote jobs
 * a US-based searcher can actually take. Jobs are copied, never mutated — the originals
 * live in the shared source cache.
 *
 * On-site postings too vague to measure go to `broad` when they name his state or only the US
 * ("Texas", "USA"). A vague posting for another state, or a job in Berlin, is simply elsewhere.
 */
export function applyRadius(
  jobs: readonly Job[],
  near: NearContext,
): { jobs: Job[]; broad: (Job & { area: 'state' | 'country' })[] } {
  const kept: Job[] = [];
  const broad: (Job & { area: 'state' | 'country' })[] = [];
  for (const job of jobs) {
    const miles = distanceTo(job, near.center);
    if (miles !== null && miles <= near.radiusMiles) {
      kept.push({ ...job, distanceMiles: Math.round(miles * 10) / 10 });
    } else if (job.remote) {
      if (near.includeRemote && remoteOpenToUS(job.location)) kept.push(job);
    } else if (miles === null && mentionsUS(job.location)) {
      const area = broadArea(job.location, near.state);
      if (area) broad.push({ ...job, area });
    }
  }
  return { jobs: kept, broad };
}

/** Nearest first; remote roles with no distance go after every placed job, order otherwise kept. */
export function sortByDistance(jobs: readonly Job[]): Job[] {
  return jobs
    .map((job, index) => ({ job, index }))
    .sort((a, b) => {
      const da = a.job.distanceMiles ?? Infinity;
      const db = b.job.distanceMiles ?? Infinity;
      return da === db ? a.index - b.index : da - db;
    })
    .map((entry) => entry.job);
}

/** How many vague postings ride along in the response; the rest are only counted. */
export const MAX_BROAD = 20;

export function nearSummary(near: NearContext, broad: (Job & { area: 'state' | 'country' })[] = []): NearSummary {
  return {
    zip: near.zip,
    label: near.label,
    radiusMiles: near.radiusMiles,
    includeRemote: near.includeRemote,
    ...(near.state ? { state: near.state } : {}),
    unplaced: broad.length,
    // His state first, then the ones that only say "USA"; each group keeps the ranked order.
    broad: [...broad.filter((job) => job.area === 'state'), ...broad.filter((job) => job.area === 'country')].slice(
      0,
      MAX_BROAD,
    ),
    ...(near.remoteOnly ? { remoteOnly: true } : {}),
  };
}
