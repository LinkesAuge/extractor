import { TesseractProvider } from './providers/tesseract-provider.js';
import { VisionProvider } from './providers/vision-provider.js';
import { HybridProvider } from './providers/hybrid-provider.js';
import { DEFAULT_SETTINGS } from './constants.js';

/** Supported OCR engine identifiers. */
export const OCR_ENGINES = {
  TESSERACT: 'tesseract',
  VISION: 'vision',
  HYBRID: 'hybrid',
};

/**
 * Creates an OCR provider based on the engine configuration.
 *
 * @param {Object} options
 * @param {string} [options.engine='tesseract'] - Engine identifier ('tesseract' or 'vision').
 * @param {Object} options.logger - Logger instance.
 * @param {Object} [options.settings={}] - OCR settings (merged with defaults for Tesseract).
 * @param {Object} [options.validationContext=null] - Runtime validation context
 *   ({ corrections, knownNames }) for immediate name corrections during OCR.
 * @returns {import('./providers/ocr-provider.js').OcrProvider}
 */
export function createOcrProvider({ engine = 'tesseract', logger, settings = {}, validationContext = null } = {}) {
  switch (engine) {
    case OCR_ENGINES.HYBRID:
      return new HybridProvider(logger, settings, validationContext);
    case OCR_ENGINES.VISION:
      return new VisionProvider(logger, settings, validationContext);
    case OCR_ENGINES.TESSERACT:
    default:
      return new TesseractProvider(logger, { ...DEFAULT_SETTINGS, ...settings }, validationContext);
  }
}
