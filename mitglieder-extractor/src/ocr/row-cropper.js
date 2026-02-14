/**
 * Row detection and cropping for TotalBattle member list screenshots.
 *
 * Detects horizontal dividers in screenshots and crops individual member rows.
 * Used to feed single-member images to the vision model instead of full
 * screenshots, which eliminates score-bleeding between adjacent members.
 *
 * All thresholds are **adaptive** — they scale with the actual image dimensions
 * so the cropper works at any resolution, not just one hardcoded screen size.
 *
 * @module ocr/row-cropper
 */

import sharp from 'sharp';

/**
 * Detect horizontal divider lines in a screenshot.
 * Dividers are identified by rows of pixels whose brightness sharply differs
 * from their neighbors (the ornamental golden lines between rows).
 *
 * Detection parameters scale with image height to work at any resolution.
 *
 * @param {Buffer} imageBuffer - Raw PNG image buffer.
 * @returns {Promise<{ dividers: number[], width: number, height: number }>}
 */
async function detectDividers(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Scale distance parameters with image height so thicker dividers
  // (at higher resolutions) are still detected correctly.
  const neighborDist = Math.max(2, Math.round(height * 0.006));
  const clusterDist = Math.max(5, Math.round(height * 0.015));

  // Calculate per-row average brightness
  const rowAvg = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      sum += data[y * width + x];
    }
    rowAvg[y] = sum / width;
  }

  // Find rows whose brightness differs sharply from their neighbors.
  // The threshold of 15 (out of 0-255) is resolution-independent because
  // it measures absolute brightness delta, not pixel distance.
  const candidates = [];
  for (let y = neighborDist; y < height - neighborDist; y++) {
    const diffAbove = Math.abs(rowAvg[y] - rowAvg[y - neighborDist]);
    const diffBelow = Math.abs(rowAvg[y] - rowAvg[y + neighborDist]);
    if (diffAbove > 15 && diffBelow > 15) {
      candidates.push(y);
    }
  }

  // Cluster nearby candidates (dividers span multiple pixel rows)
  const dividers = [];
  let lastY = -clusterDist * 2;
  for (const y of candidates) {
    if (y - lastY > clusterDist) {
      dividers.push(y);
    }
    lastY = y;
  }

  return { dividers, width, height };
}

/**
 * Compute an adaptive threshold to distinguish member rows from rank headers.
 *
 * Sorts all inter-divider gaps and finds the largest jump between consecutive
 * values. That jump separates the two size classes (rank header ~1/3 of a
 * member row) regardless of absolute pixel dimensions.
 *
 * @param {number[]} gaps - Gap heights between consecutive dividers.
 * @returns {number} Threshold: gaps >= threshold are member rows, below are headers.
 */
function computeAdaptiveThreshold(gaps) {
  if (gaps.length === 0) return 0;
  if (gaps.length === 1) return gaps[0] * 0.5;

  const sorted = [...gaps].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // All gaps within 50% of each other → no rank headers in this screenshot,
  // everything is a member row.
  if (max / min < 1.5) return min * 0.5;

  // Find the largest absolute jump between consecutive sorted gap values.
  let maxJump = 0;
  let jumpIdx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const jump = sorted[i + 1] - sorted[i];
    if (jump > maxJump) {
      maxJump = jump;
      jumpIdx = i;
    }
  }

  // Use the tallest value in the small cluster + 25% headroom.
  // This is tighter than the midpoint and avoids misclassifying partial
  // member rows (e.g. 48px) as rank headers (which are ~35px).
  return sorted[jumpIdx] * 1.25;
}

/**
 * Classify the regions between dividers as member rows, rank headers, or partials.
 *
 * Uses adaptive thresholds derived from the gap distribution —
 * works at any resolution, not just the one the code was tested against.
 *
 * @param {number[]} dividers - Y-positions of divider lines.
 * @param {number} imageHeight - Total image height.
 * @returns {Array<{ type: 'member'|'header'|'partial', y: number, height: number }>}
 */
function classifyRegions(dividers, imageHeight) {
  if (dividers.length < 2) {
    // Not enough dividers to cluster — return the whole image as a single region
    return imageHeight > 0 ? [{ type: 'partial', y: 0, height: imageHeight }] : [];
  }

  // Collect all inter-divider gaps
  const gaps = [];
  for (let i = 0; i < dividers.length - 1; i++) {
    gaps.push(dividers[i + 1] - dividers[i]);
  }

  const threshold = computeAdaptiveThreshold(gaps);
  const largestGap = Math.max(...gaps);
  // Skip regions smaller than 15% of the largest gap (tiny slivers)
  const minProcessable = largestGap * 0.15;

  const regions = [];

  // Region before the first divider — always a scroll-edge artifact.
  // Even if it's header-sized, the overlapping next screenshot will contain
  // the same header as a proper inner region, so we skip header classification
  // here to avoid false positives from partial member crops.
  if (dividers[0] > minProcessable) {
    regions.push({
      type: 'partial',
      y: 0,
      height: dividers[0],
    });
  }

  // Inner regions between consecutive dividers — only these can be headers,
  // because rank headers always have a divider both above and below.
  for (let i = 0; i < dividers.length - 1; i++) {
    const y = dividers[i];
    const gap = gaps[i];
    if (gap < minProcessable) continue;
    regions.push({
      type: gap >= threshold ? 'member' : 'header',
      y,
      height: gap,
    });
  }

  // Region after the last divider — scroll-edge artifact, never a header.
  const lastDiv = dividers[dividers.length - 1];
  const remaining = imageHeight - lastDiv;
  if (remaining > minProcessable) {
    regions.push({
      type: remaining >= threshold ? 'member' : 'partial',
      y: lastDiv,
      height: remaining,
    });
  }

  // Post-classification: upgrade the first region from 'partial' to 'header'
  // if its height closely matches the inner headers detected above.
  // This recovers rank headers that sit at the very top of the first screenshot.
  if (regions.length > 0 && regions[0].type === 'partial') {
    const innerHeaders = regions.filter(r => r.type === 'header');
    if (innerHeaders.length > 0) {
      const medianH = innerHeaders
        .map(r => r.height)
        .sort((a, b) => a - b)[Math.floor(innerHeaders.length / 2)];
      // Within 30% of median inner header height → likely a real header
      if (regions[0].height >= medianH * 0.7 && regions[0].height <= medianH * 1.3) {
        regions[0].type = 'header';
      }
    }
  }

  return regions;
}

/**
 * Crop individual member rows from a screenshot.
 * Returns cropped image buffers (PNG), one per detected member row.
 * Rank headers are returned separately for rank detection.
 *
 * @param {Buffer} imageBuffer - Raw PNG image buffer.
 * @returns {Promise<{ rows: CroppedRow[], rankHeaders: CroppedRow[] }>}
 *
 * @typedef {{ buffer: Buffer, y: number, height: number, type: string }} CroppedRow
 */
export async function cropMemberRows(imageBuffer) {
  const { dividers, width, height } = await detectDividers(imageBuffer);
  const regions = classifyRegions(dividers, height);
  const rows = [];
  const rankHeaders = [];
  for (const region of regions) {
    const buffer = await sharp(imageBuffer)
      .extract({ left: 0, top: region.y, width, height: region.height })
      .png()
      .toBuffer();
    const cropped = { buffer, y: region.y, height: region.height, type: region.type };
    if (region.type === 'header') {
      rankHeaders.push(cropped);
    } else {
      rows.push(cropped);
    }
  }
  return { rows, rankHeaders };
}

// ─── Sub-Region Crop Constants ────────────────────────────────────────────────
// Member rows have a fixed horizontal layout:
//   |-- 13% --|------ ~55% ------|-- ~7% --|--- ~16% --|-- ~9% --|
//    Avatar     Name+Coords+Badges  Shield    Score      Resource
//               (two text lines)    Icon      Digits     Icons

/**
 * Percentage of the row width occupied by the profile picture frame
 * and level badge. Trimming this area prevents the model from confusing
 * the level badge number with the player name (e.g. "0815" vs badge "334").
 */
const PROFILE_AREA_PCT = 0.13;

/** Start of the name+coordinates region (after avatar). */
const NAME_REGION_START_PCT = 0.13;

/** End of the name+coordinates region (before score icon). */
const NAME_REGION_END_PCT = 0.68;

/** Start of the score region (includes shield icon for context). */
const SCORE_REGION_START_PCT = 0.72;

/** End of the score region (before resource bag icons). */
const SCORE_REGION_END_PCT = 0.93;

/**
 * Trim the profile-picture / level-badge area from a member row image.
 * Removes the leftmost ~13 % of the image so the model only sees
 * the text content (name, coordinates, score).
 *
 * @param {Buffer} rowBuffer - PNG buffer of a single member row.
 * @returns {Promise<Buffer>} Trimmed PNG buffer.
 */
export async function trimProfileArea(rowBuffer) {
  const meta = await sharp(rowBuffer).metadata();
  const trimLeft = Math.round(meta.width * PROFILE_AREA_PCT);
  return sharp(rowBuffer)
    .extract({
      left: trimLeft,
      top: 0,
      width: meta.width - trimLeft,
      height: meta.height,
    })
    .png()
    .toBuffer();
}

/**
 * Crop the score region from a member row image.
 * Extracts the right portion of the row containing the score digits
 * (and optionally the shield icon). The isolated crop can be upscaled
 * and preprocessed aggressively for digit-optimized Tesseract OCR.
 *
 * @param {Buffer} rowBuffer - PNG buffer of a single member row.
 * @returns {Promise<Buffer>} Cropped PNG buffer of the score area.
 */
export async function cropScoreRegion(rowBuffer) {
  const meta = await sharp(rowBuffer).metadata();
  const left = Math.round(meta.width * SCORE_REGION_START_PCT);
  const right = Math.round(meta.width * SCORE_REGION_END_PCT);
  return sharp(rowBuffer)
    .extract({
      left,
      top: 0,
      width: right - left,
      height: meta.height,
    })
    .png()
    .toBuffer();
}

/**
 * Crop the name + coordinates region from a member row image.
 * Extracts the middle portion of the row containing the player name
 * (first line) and coordinates in parentheses (second line).
 * Badge icons in this area are acceptable noise for Tesseract.
 *
 * @param {Buffer} rowBuffer - PNG buffer of a single member row.
 * @returns {Promise<Buffer>} Cropped PNG buffer of the name+coords area.
 */
export async function cropNameRegion(rowBuffer) {
  const meta = await sharp(rowBuffer).metadata();
  const left = Math.round(meta.width * NAME_REGION_START_PCT);
  const right = Math.round(meta.width * NAME_REGION_END_PCT);
  return sharp(rowBuffer)
    .extract({
      left,
      top: 0,
      width: right - left,
      height: meta.height,
    })
    .png()
    .toBuffer();
}
