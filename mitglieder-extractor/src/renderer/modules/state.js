/**
 * Centralized mutable application state for the renderer.
 * All modules read/write from this single object so state is consistent.
 * @module modules/state
 */

const state = {
  // Browser
  browserReady: false,
  autoLoginAttempted: false,

  // Member capture
  currentRegion: null,
  capturing: false,
  lastOutputDir: null,

  // Member OCR
  ocrRunning: false,
  ocrMembers: null,

  // Validation (shared between member and event)
  validatedMembers: null,
  validationKnownNames: [],
  validationCorrections: {},
  selectedOcrRow: null,
  selectedOcrRows: new Set(),
  validationFilter: 'all',
  activeCorrections: new Set(),
  validationMode: 'member',
  validationSortColumn: null,
  validationSortDirection: 'asc',

  // History
  historyEntries: [],
  selectedHistoryFile: null,
  historyMembers: null,

  // Event capture
  eventRegion: null,
  eventCapturing: false,
  eventLastOutputDir: null,

  // Event OCR
  eventOcrRunning: false,
  eventOcrEntries: null,
};

export default state;
