/**
 * Overlap detection and scroll-distance recommendation for the OCR pipeline.
 *
 * After screenshots are processed, this module analyzes which members appear
 * in which screenshots to detect gaps (consecutive screenshot pairs that share
 * no members). It also estimates an optimal scroll distance based on the
 * observed region height and average member-row height.
 *
 * @module ocr/overlap-detector
 */

import { basename } from 'path';

/**
 * Minimum number of overlapping rows to target between consecutive screenshots.
 * Two rows of overlap provide a safety margin against partial crops and slight
 * scroll variations.
 */
const TARGET_OVERLAP_ROWS = 2;

/**
 * Analyze overlap between consecutive screenshots.
 *
 * Builds a per-screenshot member set from `_sourceFiles`, then checks each
 * consecutive pair for shared members. Pairs with zero overlap are flagged
 * as gaps where members may have been skipped.
 *
 * @param {Array<Object>} members - Deduplicated member list with `_sourceFiles`.
 * @param {string[]} files - Ordered list of screenshot **filenames** (basenames).
 * @param {Object} logger - Logger instance.
 * @returns {{ gaps: Array<{ before: string, after: string, index: number }>,
 *             overlapCounts: number[] }}
 */
export function detectOverlapGaps(members, files, logger) {
  if (files.length < 2) return { gaps: [], overlapCounts: [] };

  // Build map: screenshot filename → set of member coord-keys (or names)
  const screenshotMembers = new Map();
  for (const file of files) {
    screenshotMembers.set(file, new Set());
  }

  for (const member of members) {
    const key = member.coords || member.name.toLowerCase();
    for (const sourceFile of (member._sourceFiles || [])) {
      const filename = basename(sourceFile);
      if (screenshotMembers.has(filename)) {
        screenshotMembers.get(filename).add(key);
      }
    }
  }

  // Check each consecutive pair for shared members
  const gaps = [];
  const overlapCounts = [];

  for (let i = 0; i < files.length - 1; i++) {
    const membersA = screenshotMembers.get(files[i]);
    const membersB = screenshotMembers.get(files[i + 1]);

    // Count shared member keys between the two screenshots
    let shared = 0;
    for (const key of membersA) {
      if (membersB.has(key)) shared++;
    }
    overlapCounts.push(shared);

    if (shared === 0 && membersA.size > 0 && membersB.size > 0) {
      gaps.push({ before: files[i], after: files[i + 1], index: i });
    }
  }

  logOverlapSummary(gaps, overlapCounts, files, logger);

  return { gaps, overlapCounts };
}

/**
 * Estimate an optimal scroll distance from the region height and row heights.
 *
 * The goal: scroll just far enough that at least `TARGET_OVERLAP_ROWS` member
 * rows are shared between consecutive screenshots, ensuring no member is skipped.
 *
 * @param {number} regionHeight - Height of the capture region in pixels.
 * @param {number} avgRowHeight - Average member-row height in pixels (from cropper).
 * @returns {{ recommended: number, targetOverlapRows: number, overlapPx: number }}
 */
export function estimateOptimalScrollDistance(regionHeight, avgRowHeight) {
  if (regionHeight <= 0 || avgRowHeight <= 0) {
    return { recommended: 0, targetOverlapRows: TARGET_OVERLAP_ROWS, overlapPx: 0 };
  }

  const overlapPx = Math.ceil(TARGET_OVERLAP_ROWS * avgRowHeight);
  const recommended = Math.max(
    Math.round(avgRowHeight),  // never scroll less than one row
    Math.round(regionHeight - overlapPx)
  );

  return { recommended, targetOverlapRows: TARGET_OVERLAP_ROWS, overlapPx };
}

/**
 * Collect the average member-row height from an array of row-height values.
 *
 * Filters out obvious outliers (partial crops smaller than half the median)
 * and returns the mean of the remaining values.
 *
 * @param {number[]} rowHeights - Array of individual row heights.
 * @returns {number} Average row height, or 0 if no data.
 */
export function computeAverageRowHeight(rowHeights) {
  if (rowHeights.length === 0) return 0;

  const sorted = [...rowHeights].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Keep only rows within a reasonable range of the median
  // (filter out tiny partials and oversized edge artifacts)
  const filtered = sorted.filter(h => h >= median * 0.5 && h <= median * 1.5);
  if (filtered.length === 0) return median;

  const sum = filtered.reduce((acc, h) => acc + h, 0);
  return Math.round(sum / filtered.length);
}

/**
 * Build the full overlap analysis result.
 *
 * Combines gap detection with scroll-distance recommendations. This is the
 * main entry point for the VisionProvider integration.
 *
 * @param {Array<Object>} members - Deduplicated member list with `_sourceFiles`.
 * @param {string[]} files - Ordered screenshot filenames.
 * @param {number} regionHeight - Screenshot height in pixels (= capture region height).
 * @param {number[]} rowHeights - All member-row heights observed across screenshots.
 * @param {Object} logger - Logger instance.
 * @returns {OverlapAnalysis}
 *
 * @typedef {Object} OverlapAnalysis
 * @property {Array<{before: string, after: string, index: number}>} gaps
 * @property {number[]} overlapCounts
 * @property {number} avgRowHeight
 * @property {{ recommended: number, targetOverlapRows: number, overlapPx: number }} scrollRecommendation
 */
export function analyzeOverlap(members, files, regionHeight, rowHeights, logger) {
  const { gaps, overlapCounts } = detectOverlapGaps(members, files, logger);
  const avgRowHeight = computeAverageRowHeight(rowHeights);
  const scrollRecommendation = estimateOptimalScrollDistance(regionHeight, avgRowHeight);

  if (scrollRecommendation.recommended > 0) {
    logger.info(
      `Scroll-Empfehlung: ${scrollRecommendation.recommended}px ` +
      `(Region: ${regionHeight}px, Ø Zeile: ${avgRowHeight}px, ` +
      `Ziel-Überlappung: ${scrollRecommendation.targetOverlapRows} Zeilen / ${scrollRecommendation.overlapPx}px)`
    );
  }

  return { gaps, overlapCounts, avgRowHeight, scrollRecommendation };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Log a human-readable overlap summary.
 */
function logOverlapSummary(gaps, overlapCounts, files, logger) {
  if (files.length < 2) return;

  if (gaps.length === 0) {
    const minOverlap = Math.min(...overlapCounts);
    logger.info(
      `Überlappungs-Check: Alle ${files.length} Screenshots haben gemeinsame Mitglieder ` +
      `(min. ${minOverlap} pro Paar).`
    );
  } else {
    logger.warn(
      `⚠ ${gaps.length} Lücke(n) zwischen Screenshots erkannt — ` +
      `möglicherweise fehlen Mitglieder! Scroll-Distanz reduzieren.`
    );
    for (const gap of gaps) {
      logger.warn(`  Lücke: ${gap.before} ↔ ${gap.after}`);
    }
  }
}
