/**
 * Base OCR provider interface.
 * All OCR engines (Tesseract, Vision Models, etc.) must implement this contract.
 */
export class OcrProvider {
  /**
   * @param {Object} logger - Logger instance with info/success/warn/error methods.
   * @param {Object} settings - Engine-specific settings.
   */
  constructor(logger, settings = {}) {
    this.logger = logger || {
      info: console.log,
      success: console.log,
      warn: console.warn,
      error: console.error,
    };
    this.settings = { ...settings };
    this.aborted = false;
  }

  /** Signal the provider to abort current processing. */
  abort() {
    this.aborted = true;
  }

  /** Initialize the OCR engine (e.g. load model, create worker). */
  async initialize() {
    throw new Error('OcrProvider.initialize() must be implemented by subclass.');
  }

  /** Release resources (e.g. terminate workers, free memory). */
  async terminate() {
    throw new Error('OcrProvider.terminate() must be implemented by subclass.');
  }

  /**
   * Process all screenshots in a folder (member mode).
   * @param {string} folderPath - Path to folder containing PNG screenshots.
   * @param {Function} onProgress - Progress callback: ({ current, total, file }).
   * @param {Object} [settings] - Optional settings override for this run.
   * @returns {Promise<Array<{name: string, coords: string, score: number}>>}
   */
  async processFolder(folderPath, onProgress, settings) {
    throw new Error('OcrProvider.processFolder() must be implemented by subclass.');
  }

  /**
   * Process all screenshots in a folder (event mode).
   * @param {string} folderPath - Path to folder containing PNG screenshots.
   * @param {Function} onProgress - Progress callback: ({ current, total, file }).
   * @param {Object} [settings] - Optional settings override for this run.
   * @returns {Promise<Array<{name: string, power: number, eventPoints: number}>>}
   */
  async processEventFolder(folderPath, onProgress, settings) {
    throw new Error('OcrProvider.processEventFolder() must be implemented by subclass.');
  }
}
