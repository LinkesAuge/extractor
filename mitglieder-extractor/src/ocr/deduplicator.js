import { isNoiseToken } from './noise-detector.js';
import { namesAreSimilar, pickBetterScore } from './shared-utils.js';

/**
 * Name-based deduplication for member entries.
 * Handles exact duplicates, fuzzy-name duplicates, noise-prefix duplicates,
 * and optionally score-based duplicates.
 *
 * @param {Array} members - Array of member objects.
 * @param {Object} logger - Logger instance.
 * @param {{ skipScoreDedup?: boolean }} [options] - Options.
 *   Set skipScoreDedup=true for Vision OCR where score-based dedup causes false removals.
 * @returns {Array} Deduplicated members.
 */
export function deduplicateMembersByName(members, logger, options = {}) {
  const result = deduplicateExact(members, logger, {
    scoreField: 'score',
    logPrefix: '',
  });
  const afterFuzzy = deduplicateFuzzyName(result, logger);
  const afterSuffix = deduplicateSuffix(afterFuzzy, logger, {
    mergeScores: (keep, remove) => {
      const better = pickBetterScore(keep.score, remove.score);
      if (better !== keep.score) keep.score = better;
    },
  });
  if (options.skipScoreDedup) return afterSuffix;
  return deduplicateMembersByScore(afterSuffix, logger);
}

/**
 * Name-based deduplication for event entries.
 * Handles exact duplicates, noise-prefix duplicates, and score-based duplicates.
 *
 * @param {Array} entries - Array of event objects.
 * @param {Object} logger - Logger instance.
 * @returns {Array} Deduplicated entries.
 */
export function deduplicateEventsByName(entries, logger) {
  const result = deduplicateExact(entries, logger, {
    scoreField: 'power',
    logPrefix: 'Event-',
    mergeExtras: (existing, entry) => {
      const betterPoints = pickBetterScore(existing.eventPoints, entry.eventPoints);
      if (betterPoints !== existing.eventPoints) existing.eventPoints = betterPoints;
    },
  });
  const afterSuffix = deduplicateSuffix(result, logger, {
    mergeScores: (keep, remove) => {
      const betterPower = pickBetterScore(keep.power, remove.power);
      if (betterPower !== keep.power) keep.power = betterPower;
      const betterPoints = pickBetterScore(keep.eventPoints, remove.eventPoints);
      if (betterPoints !== keep.eventPoints) keep.eventPoints = betterPoints;
    },
  });
  return deduplicateEventsByScore(afterSuffix, logger);
}

// ─── Pass 1: Exact name duplicates (case-insensitive) ───────────────────────

function deduplicateExact(entries, logger, options) {
  const { scoreField, logPrefix = '', mergeExtras } = options;
  const nameMap = new Map();
  const result = [];
  for (const entry of entries) {
    const key = entry.name.toLowerCase().trim();
    if (nameMap.has(key)) {
      const idx = nameMap.get(key);
      const existing = result[idx];
      // Keep the score with more digits (less likely truncated).
      const better = pickBetterScore(existing[scoreField], entry[scoreField]);
      if (better !== existing[scoreField]) {
        existing[scoreField] = better;
        if (entry.coords) existing.coords = entry.coords;
      }
      mergeExtras?.(existing, entry);
      if (entry._sourceFiles) {
        existing._sourceFiles = [...new Set([...(existing._sourceFiles || []), ...entry._sourceFiles])];
      }
      logger.info(`  \u2715 ${logPrefix}Duplikat entfernt: "${entry.name}" — behalte Score ${existing[scoreField].toLocaleString('de-DE')}`);
    } else {
      nameMap.set(key, result.length);
      result.push({ ...entry, _sourceFiles: [...(entry._sourceFiles || [])] });
    }
  }
  return result;
}

// ─── Pass 1b: Fuzzy name duplicates (OCR near-misses) ────────────────────────
// Catches cases like "Foo Fighter" vs "Poo Fighter" (1-2 char OCR error)
// where the names are similar but not identical.

function deduplicateFuzzyName(entries, logger) {
  const toRemove = new Set();
  for (let i = 0; i < entries.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < entries.length; j++) {
      if (toRemove.has(j)) continue;
      const a = entries[i];
      const b = entries[j];
      const la = a.name.toLowerCase().trim();
      const lb = b.name.toLowerCase().trim();
      // Skip if names are identical (already handled by exact dedup)
      if (la === lb) continue;
      // Skip substring matches — those are handled by the suffix dedup pass
      if (la.includes(lb) || lb.includes(la)) continue;
      // Only catch same-length names with minor char differences (OCR noise)
      // e.g. "Foo Fighter" vs "Poo Fighter" (1 char difference)
      if (la.length !== lb.length) continue;
      let diffs = 0;
      for (let c = 0; c < la.length; c++) {
        if (la[c] !== lb[c]) diffs++;
      }
      // Adaptive threshold based on name length:
      //   < 6 chars: only 1 diff allowed (prevents "Mork"/"Dorr", "Totaur"/"Metaur")
      //   6-9 chars: max 1 diff
      //   10+ chars: max 2 diffs (catches "Foo Fighter"/"Poo Fighter")
      const maxDiffs = la.length >= 10 ? 2 : 1;
      if (diffs > maxDiffs) continue;
      // Same-length names with acceptable char diffs: keep the first entry
      const keep = entries[i];
      const remove = entries[j];
      const better = pickBetterScore(keep.score, remove.score);
      if (better !== keep.score) keep.score = better;
      keep._sourceFiles = [...new Set([...(keep._sourceFiles || []), ...(remove._sourceFiles || [])])];
      toRemove.add(j);
      logger.info(`  \u2715 Fuzzy-Duplikat: "${remove.name}" ≈ "${keep.name}" — behalte "${keep.name}"`);
    }
  }
  return entries.filter((_, idx) => !toRemove.has(idx));
}

// ─── Pass 2: Suffix matching (noise-prefix cleanup) ─────────────────────────

function deduplicateSuffix(result, logger, options) {
  const { mergeScores } = options;
  const toRemove = new Set();
  for (let i = 0; i < result.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < result.length; j++) {
      if (toRemove.has(j)) continue;
      const lowerA = result[i].name.toLowerCase();
      const lowerB = result[j].name.toLowerCase();
      let longer, shorter, longerIdx, shorterIdx;
      if (lowerA.endsWith(lowerB) && lowerA !== lowerB) {
        longer = result[i]; shorter = result[j]; longerIdx = i; shorterIdx = j;
      } else if (lowerB.endsWith(lowerA) && lowerA !== lowerB) {
        longer = result[j]; shorter = result[i]; longerIdx = j; shorterIdx = i;
      } else {
        continue;
      }
      const prefix = longer.name.substring(0, longer.name.length - shorter.name.length).trim();
      const prefixTokens = prefix.split(/\s+/).filter(Boolean);
      const allNoise = prefixTokens.length > 0 && prefixTokens.every(t => isNoiseToken(t));
      if (allNoise) {
        mergeScores(shorter, longer);
        shorter._sourceFiles = [...new Set([...(shorter._sourceFiles || []), ...(longer._sourceFiles || [])])];
        toRemove.add(longerIdx);
        logger.info(`  \u2715 Noise-Prefix entfernt: "${longer.name}" → behalte "${shorter.name}"`);
      } else {
        mergeScores(longer, shorter);
        longer._sourceFiles = [...new Set([...(longer._sourceFiles || []), ...(shorter._sourceFiles || [])])];
        toRemove.add(shorterIdx);
        logger.info(`  \u2715 Kurzname zusammengefuehrt: "${shorter.name}" → behalte "${longer.name}"`);
      }
    }
  }
  return result.filter((_, idx) => !toRemove.has(idx));
}

// ─── Pass 3: Score-based member duplicates ──────────────────────────────────

function deduplicateMembersByScore(entries, logger) {
  const scoreToRemove = new Set();
  // Adjacent duplicates
  for (let i = 0; i < entries.length - 1; i++) {
    if (scoreToRemove.has(i)) continue;
    const a = entries[i];
    const b = entries[i + 1];
    if (a.score > 0 && a.score === b.score) {
      const keepIdx = a.name.length >= b.name.length ? i : i + 1;
      const removeIdx = keepIdx === i ? i + 1 : i;
      entries[keepIdx]._sourceFiles = [...new Set([...(entries[keepIdx]._sourceFiles || []), ...(entries[removeIdx]._sourceFiles || [])])];
      scoreToRemove.add(removeIdx);
      logger.info(`  \u2715 Score-Duplikat: "${entries[removeIdx].name}" = "${entries[keepIdx].name}" (Score: ${a.score.toLocaleString('de-DE')})`);
    }
  }
  // Non-adjacent: same score + same K
  for (let i = 0; i < entries.length; i++) {
    if (scoreToRemove.has(i)) continue;
    const a = entries[i];
    if (a.score === 0) continue;
    const aParts = a.coords?.match(/K:(\d+)/);
    if (!aParts) continue;
    for (let j = i + 1; j < entries.length; j++) {
      if (scoreToRemove.has(j)) continue;
      const b = entries[j];
      if (a.score !== b.score) continue;
      const bParts = b.coords?.match(/K:(\d+)/);
      if (!bParts || aParts[1] !== bParts[1]) continue;
      const keepIdx = a.name.length >= b.name.length ? i : j;
      const removeIdx = keepIdx === i ? j : i;
      entries[keepIdx]._sourceFiles = [...new Set([...(entries[keepIdx]._sourceFiles || []), ...(entries[removeIdx]._sourceFiles || [])])];
      scoreToRemove.add(removeIdx);
      logger.info(`  \u2715 Score-Duplikat (entfernt): "${entries[removeIdx].name}" = "${entries[keepIdx].name}"`);
    }
  }
  return entries.filter((_, idx) => !scoreToRemove.has(idx));
}

// ─── Pass 3: Score-based event duplicates ───────────────────────────────────

function deduplicateEventsByScore(entries, logger) {
  const final = [];
  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    if (final.length === 0) {
      final.push({ ...curr, _sourceFiles: [...(curr._sourceFiles || [])] });
      continue;
    }
    const prev = final[final.length - 1];
    const samePower = prev.power > 0 && prev.power === curr.power;
    const sameEvent = prev.eventPoints === curr.eventPoints;
    if (samePower && sameEvent) {
      const merged = [...new Set([...(prev._sourceFiles || []), ...(curr._sourceFiles || [])])];
      if (curr.name.length > prev.name.length) {
        logger.info(`  \u2715 Score-Duplikat: "${prev.name}" → behalte "${curr.name}"`);
        final[final.length - 1] = { ...curr, _sourceFiles: merged };
      } else {
        logger.info(`  \u2715 Score-Duplikat: "${curr.name}" → behalte "${prev.name}"`);
        prev._sourceFiles = merged;
      }
    } else {
      final.push({ ...curr, _sourceFiles: [...(curr._sourceFiles || [])] });
    }
  }
  return final;
}
