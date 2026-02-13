import { TesseractProvider } from './ocr/providers/tesseract-provider.js';
import { toMemberCSV, toEventCSV } from './ocr/csv-formatter.js';

// ─── OcrProcessor ────────────────────────────────────────────────────────────

/**
 * Backward-compatible OCR processor.
 * Extends TesseractProvider and adds static CSV helper methods.
 *
 * Existing code that imports OcrProcessor continues to work unchanged.
 * New code should use createOcrProvider() from provider-factory.js instead.
 */
export class OcrProcessor extends TesseractProvider {
  // ─── Static CSV methods (backward compatibility) ──────────────────────────

  static toCSV(members) { return toMemberCSV(members); }
  static toEventCSV(entries) { return toEventCSV(entries); }
}

export default OcrProcessor;
