/**
 * Builds the two coordinate tables the ZIP-radius search runs on, from the US Census
 * Bureau's 2023 Gazetteer files (public domain):
 *
 *   https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip
 *   https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip
 *
 * Download and unzip both, then:
 *
 *   npx tsx scripts/build-geo.ts <2023_Gaz_zcta_national.txt> <2023_Gaz_place_national.txt>
 *
 * Writes server/geo/data/zips.tsv (zip, lat, lon) and server/geo/data/places.tsv
 * (state, normalized city name, lat, lon, land area in sq mi, 1 if incorporated / 0 for a CDP).
 * Coordinates are rounded to 3 decimals (~110 m), far finer than a mileage radius needs.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { normalizePlaceName } from '../server/geo/names';

const [zctaPath, placePath] = process.argv.slice(2);
if (!zctaPath || !placePath) {
  console.error('usage: tsx scripts/build-geo.ts <zcta.txt> <place.txt>');
  process.exit(1);
}

const outDir = path.resolve('server/geo/data');
mkdirSync(outDir, { recursive: true });

function rows(file: string): string[][] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim());
  return lines.slice(1).map((line) => line.split('\t').map((cell) => cell.trim()));
}

const round = (value: string) => Number(Number(value).toFixed(3));

// --- ZIPs (Census ZCTAs) ----------------------------------------------------------------
// Header: GEOID ALAND AWATER ALAND_SQMI AWATER_SQMI INTPTLAT INTPTLONG
const zipLines = rows(zctaPath)
  .filter((r) => /^\d{5}$/.test(r[0] ?? ''))
  .map((r) => `${r[0]}\t${round(r[5]!)}\t${round(r[6]!)}`)
  .sort();
writeFileSync(path.join(outDir, 'zips.tsv'), zipLines.join('\n') + '\n');

// --- Places (cities, towns, villages, CDPs) -----------------------------------------------
// Header: USPS GEOID ANSICODE NAME LSAD FUNCSTAT ALAND AWATER ALAND_SQMI AWATER_SQMI INTPTLAT INTPTLONG
interface Candidate {
  state: string;
  name: string;
  lat: number;
  lon: number;
  incorporated: boolean;
  land: number;
}

const best = new Map<string, Candidate>();
function offer(candidate: Candidate) {
  if (!candidate.name) return;
  const key = `${candidate.state}|${candidate.name}`;
  const current = best.get(key);
  // Two places can normalize to the same name in one state (a city and a CDP of the same
  // name). Prefer the incorporated one, then the larger — that is the one a posting means.
  if (
    !current ||
    (candidate.incorporated && !current.incorporated) ||
    (candidate.incorporated === current.incorporated && candidate.land > current.land)
  ) {
    best.set(key, candidate);
  }
}

for (const r of rows(placePath)) {
  const [state, , , rawName, , funcstat, aland, , , , lat, lon] = r;
  if (!state || !rawName || !lat || !lon) continue;
  const base = {
    state,
    lat: round(lat),
    lon: round(lon),
    // S = statistical (CDP). Everything else is a real government, including the
    // "(balance)" halves of consolidated city-counties (Nashville, Louisville) marked F.
    incorporated: funcstat !== 'S',
    land: Number(aland) || 0,
  };
  for (const name of normalizePlaceName(rawName)) offer({ ...base, name });
}

const placeLines = [...best.values()]
  .map((p) => `${p.state}\t${p.name}\t${p.lat}\t${p.lon}\t${Math.round(p.land / 2_589_988)}\t${p.incorporated ? 1 : 0}`)
  .sort();
writeFileSync(path.join(outDir, 'places.tsv'), placeLines.join('\n') + '\n');

console.log(`zips.tsv: ${zipLines.length} rows · places.tsv: ${placeLines.length} rows → ${outDir}`);
