/**
 * Post-OCR sanity checks for member results.
 *
 * Annotates entries with `_warning` and `_warningDetail` fields
 * to flag suspicious data (hallucinations, score anomalies, etc.).
 * Does NOT remove entries — the user decides in the validation UI.
 *
 * @module ocr/sanity-checker
 */

/** Regex for valid coordinate format: "K:98 X:666 Y:852" */
const COORDS_REGEX = /^K:(\d{1,3})\s+X:\d+\s+Y:\d+$/;

/**
 * Run sanity checks on member OCR results and annotate suspicious entries.
 *
 * Checks performed (in order):
 *   1. Invalid coords format (no K:XX X:YY Y:ZZ pattern)
 *   2. K-value consistency (deviates from the dominant kingdom)
 *   3. Duplicate coordinates (two entries share the same coords)
 *   4. Zero score
 *   5. Score outlier (>80% deviation from neighbors)
 *
 * @param {Array<Object>} members - Member entries with `name`, `coords`, `score`.
 * @param {Object} logger - Logger instance (info/warn methods).
 * @param {Object} [options] - Optional thresholds.
 * @param {number} [options.scoreOutlierThreshold=0.2] - Ratio below which a score is flagged
 *   relative to its neighbors (0.2 = 20%).
 * @returns {Array<Object>} Same array, with `_warning` / `_warningDetail` annotations.
 */
export function runMemberSanityChecks(members, logger, options = {}) {
  if (!members || members.length === 0) return members;
  const outlierThreshold = options.scoreOutlierThreshold ?? 0.2;
  let warningCount = 0;

  // ─── 1. Invalid coords format ───────────────────────────────────────────
  for (const entry of members) {
    if (!entry.coords || !COORDS_REGEX.test(entry.coords)) {
      if (!entry._warning) {
        setWarning(entry, 'invalid_coords', `Ungueltige Koordinaten: "${entry.coords || '(leer)'}"`);
        logger.warn(`⚠ ${entry.name}: ungueltige Koordinaten "${entry.coords || '(leer)'}"`);
        warningCount++;
      }
    }
  }

  // ─── 2. K-value consistency ─────────────────────────────────────────────
  const dominantK = findDominantK(members);
  if (dominantK !== null) {
    for (const entry of members) {
      if (entry._warning) continue; // already flagged as invalid
      const k = parseKValue(entry.coords);
      if (k !== null && k !== dominantK) {
        setWarning(entry, 'wrong_kingdom', `K:${k} weicht ab (erwartet K:${dominantK})`);
        logger.warn(`⚠ ${entry.name}: K:${k} weicht von K:${dominantK} ab`);
        warningCount++;
      }
    }
  }

  // ─── 3. Duplicate coordinates ───────────────────────────────────────────
  const coordsMap = new Map();
  for (let i = 0; i < members.length; i++) {
    const entry = members[i];
    if (!entry.coords || entry._warning) continue;
    const key = entry.coords.trim();
    if (coordsMap.has(key)) {
      const existing = coordsMap.get(key);
      // Flag the one with the lower score (more likely to be the hallucination)
      const loser = entry.score < existing.score ? entry : existing;
      if (!loser._warning) {
        const winner = loser === entry ? existing : entry;
        const winnerName = winner.name || '(unbekannt)';
        setWarning(loser, 'duplicate_coords', `Gleiche Koordinaten wie "${winnerName}"`);
        logger.warn(`⚠ ${loser.name || '?'}: gleiche Koordinaten wie "${winnerName}" (${key})`);
        warningCount++;
      }
    } else {
      coordsMap.set(key, entry);
    }
  }

  // ─── 4. Zero score ─────────────────────────────────────────────────────
  for (const entry of members) {
    if (entry._warning) continue;
    if (entry.score === 0) {
      setWarning(entry, 'score_zero', 'Score ist 0');
      logger.warn(`⚠ ${entry.name}: Score ist 0`);
      warningCount++;
    }
  }

  // ─── 5. Score outlier (neighbor comparison) ─────────────────────────────
  checkScoreOutliers(members, outlierThreshold, logger, (count) => { warningCount += count; });

  if (warningCount > 0) {
    logger.warn(`${warningCount} verdaechtige(r) Eintrag/Eintraege gefunden — bitte in der Validierung pruefen.`);
  }
  return members;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Internal helpers ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set a warning on an entry (only the first warning wins).
 * @param {Object} entry
 * @param {string} type - Warning type identifier.
 * @param {string} detail - Human-readable detail.
 */
function setWarning(entry, type, detail) {
  if (!entry._warning) {
    entry._warning = type;
    entry._warningDetail = detail;
  }
}

/**
 * Parse the K-value from a coords string.
 * @param {string} coords - e.g. "K:98 X:666 Y:852"
 * @returns {number|null} The K number or null if unparseable.
 */
function parseKValue(coords) {
  if (!coords) return null;
  const match = coords.match(/^K:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Find the most common K-value across all members.
 * Returns null if fewer than 3 valid entries.
 * @param {Array<Object>} members
 * @returns {number|null}
 */
function findDominantK(members) {
  const counts = new Map();
  for (const entry of members) {
    const k = parseKValue(entry.coords);
    if (k !== null) {
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  let bestK = null;
  let bestCount = 0;
  for (const [k, count] of counts) {
    if (count > bestCount) {
      bestK = k;
      bestCount = count;
    }
  }
  // Only enforce if at least 80% of entries share the same K
  const totalValid = [...counts.values()].reduce((a, b) => a + b, 0);
  return bestCount / totalValid >= 0.8 ? bestK : null;
}

/**
 * Check for score outliers by comparing each entry to its nearest neighbors.
 * Entries already flagged with _warning are skipped as comparison targets.
 *
 * @param {Array<Object>} members
 * @param {number} threshold - Ratio below which a score is considered an outlier (e.g. 0.2).
 * @param {Object} logger
 * @param {Function} addWarnings - Callback to increment warning count.
 */
function checkScoreOutliers(members, threshold, logger, addWarnings) {
  // Build a list of indices with valid (unflagged, non-zero) scores for neighbor comparison
  const validIndices = [];
  for (let i = 0; i < members.length; i++) {
    if (!members[i]._warning && members[i].score > 0) {
      validIndices.push(i);
    }
  }
  if (validIndices.length < 3) return;

  let count = 0;
  for (let vi = 0; vi < validIndices.length; vi++) {
    const idx = validIndices[vi];
    const entry = members[idx];
    // Get up to 2 neighbors (before and after in the valid list)
    const neighbors = [];
    if (vi > 0) neighbors.push(members[validIndices[vi - 1]].score);
    if (vi < validIndices.length - 1) neighbors.push(members[validIndices[vi + 1]].score);
    if (neighbors.length === 0) continue;
    const avgNeighbor = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
    if (avgNeighbor === 0) continue;
    const ratio = entry.score / avgNeighbor;
    if (ratio < threshold) {
      const pctDiff = Math.round((1 - ratio) * 100);
      setWarning(entry, 'score_outlier', `Score ${pctDiff}% niedriger als Nachbarn (${Math.round(avgNeighbor).toLocaleString('de-DE')})`);
      logger.warn(`⚠ ${entry.name}: Score ${entry.score.toLocaleString('de-DE')} ist ${pctDiff}% niedriger als Nachbar-Durchschnitt ${Math.round(avgNeighbor).toLocaleString('de-DE')}`);
      count++;
    } else if (ratio > (1 / threshold)) {
      const pctDiff = Math.round((ratio - 1) * 100);
      setWarning(entry, 'score_outlier', `Score ${pctDiff}% hoeher als Nachbarn (${Math.round(avgNeighbor).toLocaleString('de-DE')})`);
      logger.warn(`⚠ ${entry.name}: Score ${entry.score.toLocaleString('de-DE')} ist ${pctDiff}% hoeher als Nachbar-Durchschnitt ${Math.round(avgNeighbor).toLocaleString('de-DE')}`);
      count++;
    }
  }
  addWarnings(count);
}
