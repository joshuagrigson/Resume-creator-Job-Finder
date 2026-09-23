/**
 * Place-name normalization shared by the table builder (scripts/build-geo.ts) and the
 * runtime lookup, so "St. Louis city" in the Census file and "Saint Louis, MO" in a job
 * posting land on the same key.
 */

// Case-sensitive on purpose: the Census writes the legal description in lower case
// ("Boise City city"), so a capitalised "City" is part of the name ("Carson City").
const LSAD_SUFFIX =
  /\s+(city and borough|consolidated government|metropolitan government|metro government|unified government|urban county|municipality|comunidad|zona urbana|plantation|corporation|township|borough|village|city|town|CDP)$/;

/** Lowercase, strip punctuation, and fold the spellings postings disagree on. */
export function normalizeCity(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.'’]/g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\bmount\b/g, 'mt')
    .replace(/\bfort\b/g, 'ft')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Every key a Census place NAME should be findable under:
 *   "Austin city"                                    → ["austin"]
 *   "Nashville-Davidson metropolitan government (balance)" → ["nashville davidson", "nashville"]
 *   "Louisville/Jefferson County metro government (balance)" → ["louisville jefferson county", "louisville"]
 *   "Urban Honolulu CDP"                             → ["urban honolulu", "honolulu"]
 */
export function normalizePlaceName(raw: string): string[] {
  // Exactly one legal-description suffix per name. Stripping repeatedly turned
  // "Wake Village city" into "wake".
  const name = raw.replace(/\s*\(balance\)\s*$/i, '').trim().replace(LSAD_SUFFIX, '').trim();

  const keys = new Set<string>();
  const full = normalizeCity(name);
  if (full) keys.add(full);

  // Consolidated city-counties are posted under the city's own name.
  const consolidated = /government|county|\(balance\)/i.test(raw);
  const split = name.split(/[-/]/);
  if (consolidated && split.length > 1) {
    const head = normalizeCity(split[0]!);
    if (head) keys.add(head);
  }
  if (/^urban\s+/i.test(name)) keys.add(normalizeCity(name.replace(/^urban\s+/i, '')));

  return [...keys];
}
