/**
 * Lightweight runtime name correction for OCR pipeline.
 *
 * Applied per-entry BEFORE merge and dedup so that corrected names
 * flow into coordinate-based merging and name-based deduplication.
 *
 * @module ocr/name-corrector
 */

/**
 * Apply known corrections and fuzzy-match a name against known players.
 *
 * Priority:
 *  1. Direct correction lookup (case-insensitive)
 *  2. Exact known-name match (case-insensitive) — normalizes capitalization
 *  3. Fuzzy match: Levenshtein distance <= threshold against knownNames
 *
 * @param {string} name - Raw OCR name.
 * @param {Object} ctx - Validation context.
 * @param {Object}   ctx.corrections - Map of OCR misreadings → correct names.
 * @param {string[]}  ctx.knownNames - Array of canonical player names.
 * @param {Map}       [ctx._lowerMap] - Pre-built lowercase → canonical map (optional, built on first use).
 * @returns {{ name: string, corrected: boolean, method: string | null }}
 */
export function applyKnownCorrections(name, ctx) {
  if (!ctx || !name) return { name, corrected: false, method: null };
  const corrections = ctx.corrections || {};
  const knownNames = ctx.knownNames || [];
  // Lazily build lowercase lookup map for O(1) known-name matching
  if (!ctx._lowerMap) {
    ctx._lowerMap = new Map(knownNames.map(n => [n.toLowerCase(), n]));
  }
  // Lazily build lowercase corrections map for case-insensitive lookup
  if (!ctx._correctionsLower) {
    ctx._correctionsLower = new Map(
      Object.entries(corrections).map(([k, v]) => [k.toLowerCase(), v]),
    );
  }
  // ─── Step 1: Direct correction lookup ───────────────────────────────────
  const correctionHit = corrections[name] || ctx._correctionsLower.get(name.toLowerCase());
  if (correctionHit) {
    // Resolve to canonical casing if the correction target is also a known name
    const canonical = ctx._lowerMap.get(correctionHit.toLowerCase()) || correctionHit;
    return { name: canonical, corrected: true, method: 'correction' };
  }
  // ─── Step 2: Exact known-name match (case-insensitive) ─────────────────
  const canonical = ctx._lowerMap.get(name.toLowerCase());
  if (canonical && canonical !== name) {
    return { name: canonical, corrected: true, method: 'canonical' };
  }
  if (canonical) {
    return { name, corrected: false, method: null };
  }
  // ─── Step 3: Fuzzy match (Levenshtein) ─────────────────────────────────
  const fuzzyResult = fuzzyMatchName(name, knownNames);
  if (fuzzyResult) {
    return { name: fuzzyResult, corrected: true, method: 'fuzzy' };
  }
  return { name, corrected: false, method: null };
}

/**
 * Find the closest known name using Levenshtein distance and suffix matching.
 *
 * @param {string} name - OCR name to match.
 * @param {string[]} knownNames - List of canonical names.
 * @returns {string | null} Best match, or null if none close enough.
 */
function fuzzyMatchName(name, knownNames) {
  if (knownNames.length === 0) return null;
  const nameLower = name.toLowerCase();
  let bestMatch = null;
  let bestDist = Infinity;
  for (const known of knownNames) {
    const knownLower = known.toLowerCase();
    if (nameLower === knownLower) return known;
    // Suffix match: OCR noise-prefix (e.g. "AB Foo Fighter" → "Foo Fighter")
    if (nameLower.endsWith(knownLower) || knownLower.endsWith(nameLower)) {
      return known;
    }
    // Levenshtein distance with adaptive threshold
    const dist = levenshtein(nameLower, knownLower);
    const maxLen = Math.max(nameLower.length, knownLower.length);
    const threshold = maxLen >= 5 ? 2 : 1;
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestMatch = known;
    }
  }
  return bestMatch;
}

/**
 * Levenshtein distance between two strings.
 * Space-optimized single-row DP.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Edit distance.
 */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // delete
        curr[j - 1] + 1,   // insert
        prev[j - 1] + cost, // replace
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
