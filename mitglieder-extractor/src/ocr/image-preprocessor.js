import sharp from 'sharp';

/** White border padding to improve Tesseract segmentation. */
const BORDER = 20;

// ─── Sub-Region Preprocessing Presets ─────────────────────────────────────────

/**
 * Preprocessing preset optimized for score digit recognition.
 * Aggressive upscale + high contrast + threshold for clean digit shapes.
 * Used with Tesseract PSM 6 (uniform block) and digit-only whitelist.
 */
export const SCORE_PRESET = {
  scale: 4,
  greyscale: true,
  contrast: 2.0,
  sharpen: 0.5,
  threshold: 150,
};

/**
 * Preprocessing preset optimized for name + coordinate text recognition.
 * Moderate settings that preserve special characters (umlauts, spaces, numbers).
 * Used with Tesseract PSM 6 (uniform block) for multi-line name+coords text.
 */
export const NAME_PRESET = {
  scale: 3,
  greyscale: true,
  contrast: 1.5,
  sharpen: 0.3,
  threshold: 140,
};

/**
 * Preprocesses an image buffer for OCR using configurable parameters.
 *
 * @param {Buffer} buffer - Raw image buffer (PNG).
 * @param {Object} settings - Preprocessing settings.
 * @param {number} settings.scale - Scale factor (1-4).
 * @param {boolean} settings.greyscale - Convert to greyscale.
 * @param {number} settings.sharpen - Sharpening sigma (0 = off).
 * @param {number} settings.contrast - Contrast multiplier (1.0 = no change).
 * @param {number} settings.threshold - Binarization threshold (0 = off).
 * @returns {Promise<Buffer>} Processed image buffer.
 */
export async function preprocessImage(buffer, settings) {
  const { scale, greyscale, sharpen, contrast, threshold } = settings;
  const meta = await sharp(buffer).metadata();
  let pipeline = sharp(buffer);
  if (scale > 1) {
    pipeline = pipeline.resize({ width: Math.round(meta.width * scale), kernel: 'lanczos3' });
  }
  if (greyscale) {
    pipeline = pipeline.greyscale();
  }
  if (contrast > 1.0) {
    pipeline = pipeline.linear(contrast, -(128 * contrast - 128));
  }
  if (sharpen > 0) {
    pipeline = pipeline.sharpen({ sigma: sharpen });
  }
  if (threshold > 0) {
    pipeline = pipeline.threshold(threshold);
  }
  pipeline = pipeline.extend({
    top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
    background: { r: 255, g: 255, b: 255 },
  });
  return pipeline.toBuffer();
}
