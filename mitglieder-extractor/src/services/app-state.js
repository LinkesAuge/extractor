import ValidationManager from '../validation-manager.js';
import { APP_DATA_DIR } from '../utils/paths.js';

/**
 * Centralized mutable application state.
 * Shared across all IPC handler modules.
 */
const appState = {
  /** @type {import('electron').BrowserWindow | null} */
  mainWindow: null,

  /** @type {import('playwright').BrowserContext | null} */
  browserContext: null,

  /** @type {import('playwright').Page | null} */
  page: null,

  /** Whether a member capture is being aborted. */
  captureAborted: false,

  /** Whether an event capture is being aborted. */
  eventCaptureAborted: false,

  /** @type {import('../ocr/providers/ocr-provider.js').OcrProvider | null} */
  ocrProcessor: null,

  /** @type {import('../ocr/providers/ocr-provider.js').OcrProvider | null} */
  eventOcrProcessor: null,

  /** Validation manager instance. */
  validationManager: new ValidationManager(APP_DATA_DIR),
};

export default appState;
