/**
 * ZIP-radius geography.
 *
 * Two Census-derived tables (built by scripts/build-geo.ts, public domain):
 *   data/zips.tsv   — every US ZIP (ZCTA) → centroid
 *   data/places.tsv — every US city/town/CDP, keyed by state + normalized name → centroid
 *
 * Both load on first use and stay in memory (~65k rows). Nothing here touches the network.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizeCity } from './names';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Place extends GeoPoint {
  state: string;
  name: string;
  /** Land area in square miles (0 for aliases). */
  land: number;
  /** False for Census-designated places (unincorporated communities). */
  incorporated: boolean;
}

export type GeoFile = 'zips.tsv' | 'places.tsv';

/** Node reads the tables from disk next to this file. */
function readFromDisk(file: GeoFile): string {
  const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
  return readFileSync(path.join(dataDir, file), 'utf8');
}

let loadGeoFile: (file: GeoFile) => string = readFromDisk;

/**
 * Where the two tables come from. Cloudflare Workers has no disk to read, so the Worker entry
 * bundles both files as text and hands them over here before the first request.
 */
export function setGeoSource(load: (file: GeoFile) => string): void {
  loadGeoFile = load;
  zips = null;
  places = null;
  placeList = null;
}

let zips: Map<string, GeoPoint> | null = null;
let places: Map<string, Place> | null = null;
let placeList: Place[] | null = null;

function readTsv(file: GeoFile): string[][] {
  return loadGeoFile(file)
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

function zipTable(): Map<string, GeoPoint> {
  if (!zips) {
    zips = new Map();
    for (const [zip, lat, lon] of readTsv('zips.tsv')) zips.set(zip!, { lat: Number(lat), lon: Number(lon) });
  }
  return zips;
}

function placeTable(): Map<string, Place> {
  if (!places) {
    places = new Map();
    placeList = [];
    for (const [state, name, lat, lon, land, inc] of readTsv('places.tsv')) {
      const place: Place = {
        state: state!,
        name: name!,
        lat: Number(lat),
        lon: Number(lon),
        land: Number(land) || 0,
        incorporated: inc === '1',
      };
      places.set(`${place.state}|${place.name}`, place);
      placeList.push(place);
    }
    // Names postings use that the Census files file under something else.
    for (const [state, name, lat, lon] of ALIASES) {
      places.set(`${state}|${name}`, { state, name, lat, lon, land: 0, incorporated: false });
    }
  }
  return places;
}

/** NYC boroughs and a few shorthands postings use instead of the Census place name. */
const ALIASES: [string, string, number, number][] = [
  ['NY', 'brooklyn', 40.65, -73.95],
  ['NY', 'queens', 40.742, -73.769],
  ['NY', 'bronx', 40.837, -73.866],
  ['NY', 'the bronx', 40.837, -73.866],
  ['NY', 'manhattan', 40.776, -73.971],
  ['NY', 'staten island', 40.58, -74.152],
  ['NY', 'nyc', 40.713, -74.006],
  ['NY', 'new york city', 40.713, -74.006],
  ['DC', 'dc', 38.904, -77.017],
  ['DC', 'washington dc', 38.904, -77.017],
];

export const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'puerto rico': 'PR',
};
const STATE_CODES = new Set(Object.values(US_STATES));

/** "tx", "TX", "Texas" → "TX"; anything else → null. */
export function stateCode(value: string): string | null {
  const v = value.trim().replace(/\.$/, '');
  if (/^[a-z]{2}$/i.test(v) && STATE_CODES.has(v.toUpperCase())) return v.toUpperCase();
  return US_STATES[v.toLowerCase()] ?? null;
}

export function isZip(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{5}$/.test(value.trim());
}

export function zipPoint(zip: string): GeoPoint | null {
  return zipTable().get(zip.trim()) ?? null;
}

export function findPlace(city: string, state: string): Place | null {
  const code = stateCode(state);
  if (!code) return null;
  return placeTable().get(`${code}|${normalizeCity(city)}`) ?? null;
}

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle distance in miles. */
export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The town a point is in — used to name a ZIP ("West Lake Hills, TX", "New York, NY").
 *
 * Nearest centroid alone gets big cities wrong: Manhattan's 10001 sits closer to Hoboken's
 * centre than to New York's. So first look for incorporated places whose approximate extent
 * (a circle of the same land area) covers the point and take the most specific one; only
 * when none does, fall back to the nearest place of any kind.
 */
export function nearestPlace(point: GeoPoint): Place | null {
  placeTable();
  let containing: Place | null = null;
  let closestRelative: Place | null = null;
  let closestRatio = Infinity;
  let nearest: Place | null = null;
  let nearestDistance = Infinity;
  for (const place of placeList ?? []) {
    // Cheap box reject before the trig.
    if (Math.abs(place.lat - point.lat) > 1 || Math.abs(place.lon - point.lon) > 1.5) continue;
    const d = haversineMiles(point, place);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = place;
    }
    if (place.land <= 0) continue;
    // Distance measured in "radii of this town": ≤ 1 means inside it.
    const ratio = d / Math.sqrt(place.land / Math.PI);
    if (ratio <= 1.15 && (!containing || place.land < containing.land)) containing = place;
    if (ratio < closestRatio) {
      closestRatio = ratio;
      closestRelative = place;
    }
  }
  // Rural ZIPs sit outside every town; name the one they're relatively closest to, as long
  // as it isn't absurdly far, else whatever place is physically nearest.
  return containing ?? (closestRatio <= 3 ? closestRelative : null) ?? nearest;
}

/**
 * The biggest city within `miles` — the name a job board that only filters by city would
 * list local postings under (78746 → Austin, not West Lake Hills). Land area is the size
 * proxy (the Census place file carries no population); incorporated places win over CDPs,
 * which can be vast and empty.
 */
export function anchorCity(point: GeoPoint, miles: number): Place | null {
  placeTable();
  let best: Place | null = null;
  const rank = (place: Place) => (place.incorporated ? 1e6 : 0) + place.land;
  for (const place of placeList ?? []) {
    if (place.land <= 0) continue;
    if (Math.abs(place.lat - point.lat) > miles / 60 || Math.abs(place.lon - point.lon) > miles / 40) continue;
    if (haversineMiles(point, place) > miles) continue;
    if (!best || rank(place) > rank(best)) best = place;
  }
  return best;
}

/** "west lake hills" → "West Lake Hills" for display. */
export function titleCase(name: string): string {
  return name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// --- job location strings ------------------------------------------------------------------

// Plain "America" is left out on purpose: "Latin America" and "South America" aren't the US.
const US_MARKERS = /\b(u\.?s\.?a?|united states(?: of america)?|americas|north america)\b/i;
const ANYWHERE = /\b(anywhere|worldwide|global|international)\b/i;

/** True when a location names a US state or the US itself ("Remote — USA", "Ohio"). */
/** The US state codes a location names ("Texas; Oklahoma" → TX, OK). */
export function statesIn(location: string): string[] {
  const codes = location
    .split(/[,;|/()–—-]+/)
    .map((part) => stateCode(part))
    .filter((code): code is string => code !== null);
  return [...new Set(codes)];
}

/**
 * How wide an unmeasurable US posting is, relative to a searcher's state: "state" when it names
 * only a state (his among them), "country" when it only says USA / United States, null when it
 * names other states only or isn't in the US at all.
 */
export function broadArea(location: string, homeState: string | null): 'state' | 'country' | null {
  const states = statesIn(location);
  if (states.length > 0) return homeState && states.includes(homeState) ? 'state' : null;
  return US_MARKERS.test(location) ? 'country' : null;
}

export function mentionsUS(location: string): boolean {
  if (US_MARKERS.test(location)) return true;
  return location.split(/[,;|/()–—-]+/).some((part) => stateCode(part) !== null);
}

/**
 * Whether a remote role is open to someone in the US: unrestricted ("Remote", "Worldwide"),
 * US/Americas-restricted, or pinned to a US place. "Remote — Brazil" and "Remote (EU)" are not.
 */
export function remoteOpenToUS(location: string): boolean {
  const text = location.replace(/\b(remote|hybrid|work from home|wfh)\b/gi, ' ').replace(/[^\p{L}\p{N}.]+/gu, ' ').trim();
  if (!text) return true;
  if (ANYWHERE.test(text)) return true;
  return mentionsUS(location);
}

const NOISE =
  /\b(hybrid|on[- ]?site|in[- ]?office|remote|office|headquarters|hq|metro(?:politan)? area|area|greater|downtown|usa|us|united states(?: of america)?)\b/gi;

function resolveSegment(segment: string): GeoPoint | null {
  const zip = segment.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip) {
    const point = zipPoint(zip[1]!);
    if (point) return point;
  }

  const parts = segment
    .replace(/\b\d{5}(?:-\d{4})?\b/g, ' ')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  // "City, ST[, Country]" — find the state part and read the city from just before it.
  for (let i = 1; i < parts.length; i += 1) {
    const code = stateCode(parts[i]!);
    if (!code) continue;
    const city = parts[i - 1]!.replace(NOISE, ' ').replace(/[()–—-]+/g, ' ').trim();
    if (!city) continue;
    const place = findPlace(city, code);
    if (place) return place;
  }

  // "Austin TX" with no comma.
  const bare = segment.match(/^(.*?)[\s,]+([A-Za-z]{2})\s*$/);
  if (bare) {
    const code = stateCode(bare[2]!);
    const city = bare[1]!.replace(NOISE, ' ').replace(/[()–—-]+/g, ' ').trim();
    if (code && city) {
      const place = findPlace(city, code);
      if (place) return place;
    }
  }
  return null;
}

const resolved = new Map<string, GeoPoint[]>();
const RESOLVE_CACHE_LIMIT = 20_000;

/**
 * Every point a posting's location string names. Multi-location postings
 * ("Austin, TX; Dallas, TX", "Austin, TX or Remote") return one point per place, so the
 * caller can take the nearest. City names without a state are ambiguous (there are 30
 * Springfields) and are deliberately not guessed.
 */
export function resolveLocation(location: string): GeoPoint[] {
  const key = location.trim();
  if (!key) return [];
  const hit = resolved.get(key);
  if (hit) return hit;

  const points: GeoPoint[] = [];
  for (const segment of key.split(/\s*(?:;|\||•|\/| or | and )\s*/i)) {
    const point = resolveSegment(segment);
    if (point) points.push(point);
  }
  if (resolved.size >= RESOLVE_CACHE_LIMIT) resolved.clear();
  resolved.set(key, points);
  return points;
}

/**
 * Parse both tables now (about 90 ms). The Cloudflare Worker calls this at startup, where the
 * budget is generous, so no request pays for it against the per-request CPU limit.
 */
export function warmGeo(): void {
  zipTable();
  placeTable();
}
