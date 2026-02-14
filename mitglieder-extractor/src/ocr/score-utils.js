import { SCORE_REGEX, SCORE_FALLBACK_REGEX } from './constants.js';

/**
 * Extracts the first valid score from a text segment.
 * Uses SCORE_REGEX first, falls back to SCORE_FALLBACK_REGEX.
 *
 * @param {string} text - Full OCR text.
 * @param {number} fromIndex - Start index in text.
 * @param {number} toIndex - End index in text.
 * @param {number} minScore - Minimum score threshold.
 * @returns {number} Extracted score or 0.
 */
export function extractScore(text, fromIndex, toIndex, minScore) {
  let segment = text.substring(fromIndex, toIndex);
  segment = segment.replace(/([,.])\s*([,.])/g, '$1');
  const scoreRe = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags);
  let sm;
  while ((sm = scoreRe.exec(segment)) !== null) {
    const num = parseInt(sm[1].replace(/[,.\u00A0\s]/g, ''), 10);
    if (num >= minScore) return num;
  }
  const fallbackRe = new RegExp(SCORE_FALLBACK_REGEX.source, SCORE_FALLBACK_REGEX.flags);
  while ((sm = fallbackRe.exec(segment)) !== null) {
    const num = parseInt(sm[1].replace(/[,.\u00A0\s]/g, ''), 10);
    if (num >= minScore) return num;
  }
  return 0;
}

/**
 * Finds the boundary index until which to search for a score.
 * Returns the position of the next coordinate match or rank header, whichever comes first.
 *
 * @param {string} text - Full OCR text.
 * @param {number} afterIndex - Search starts after this index.
 * @param {Array} coords - Array of coordinate matches.
 * @param {number} currentIdx - Index of current coordinate in coords array.
 * @param {Array} rankPositions - Array of rank header positions.
 * @returns {number} Boundary index.
 */
export function findNextBoundary(text, afterIndex, coords, currentIdx, rankPositions) {
  let boundary = text.length;
  if (currentIdx + 1 < coords.length) {
    boundary = Math.min(boundary, coords[currentIdx + 1].index);
  }
  for (const rp of rankPositions) {
    if (rp.index > afterIndex && rp.index < boundary) {
      boundary = rp.index;
      break;
    }
  }
  return boundary;
}

/**
 * Resolves score conflicts between two OCR passes.
 *
 * Common OCR errors:
 *   1) Leading digits lost: 5,822,073 → 822,073 (smaller is wrong)
 *   2) First digit misread: 8,939,291 → 3,939,291 (smaller is wrong)
 *   3) Comma→digit error: ~10x larger → larger is wrong
 *
 * @param {number} scoreA - Score from first pass.
 * @param {number} scoreB - Score from second pass.
 * @returns {number} Resolved score.
 */
export function resolveScoreConflict(scoreA, scoreB) {
  if (scoreA === 0 && scoreB > 0) return scoreB;
  if (scoreB === 0 && scoreA > 0) return scoreA;
  if (scoreA === scoreB) return scoreA;
  const larger = Math.max(scoreA, scoreB);
  const smaller = Math.min(scoreA, scoreB);
  const strLarger = String(larger);
  const strSmaller = String(smaller);
  // Leading-digit loss: smaller is suffix of larger
  if (strLarger.endsWith(strSmaller)) return larger;
  // First digit misread: same length, tail matches
  if (strLarger.length === strSmaller.length) {
    const checkTail = Math.max(3, strLarger.length - 2);
    if (strLarger.slice(-checkTail) === strSmaller.slice(-checkTail)) return larger;
  }
  // Ratio-based: 5x-15x difference suggests comma→digit error
  const ratio = larger / smaller;
  if (ratio >= 5 && ratio <= 15) return smaller;
  return scoreA;
}
