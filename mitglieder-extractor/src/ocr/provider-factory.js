import { TesseractProvider } from './providers/tesseract-provider.js';
import { DEFAULT_SETTINGS } from './constants.js';

/** Supported OCR engine identifiers. */
export const OCR_ENGINES = {
  TESSERACT: 'tesseract',
  VISION: 'vision',
};

/**
 * Creates an OCR provider based on the engine configuration.
 *
 * @param {Object} options
 * @param {string} [options.engine='tesseract'] - Engine identifier ('tesseract' or 'vision').
 * @param {Object} options.logger - Logger instance.
 * @param {Object} [options.settings={}] - OCR settings (merged with defaults for Tesseract).
 * @returns {import('./providers/ocr-provider.js').OcrProvider}
 */
export function createOcrProvider({ engine = 'tesseract', logger, settings = {} } = {}) {
  switch (engine) {
    case OCR_ENGINES.VISION:
      // Phase 3: VisionProvider will be added here
      throw new Error('Vision provider not yet implemented. Use "tesseract" engine.');
    case OCR_ENGINES.TESSERACT:
    default:
      return new TesseractProvider(logger, { ...DEFAULT_SETTINGS, ...settings });
  }
}
