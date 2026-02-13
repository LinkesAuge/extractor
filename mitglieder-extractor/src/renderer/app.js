/**
 * Application entry point for the renderer process.
 * Initializes all UI modules and coordinates cross-module interactions.
 * @module app
 */

import { $ } from './utils/helpers.js';
import state from './modules/state.js';
import { saveCurrentConfig, loadAndRestoreConfig } from './modules/config.js';
import { initBrowserUI, refreshBrowserUI } from './modules/browser-ui.js';
import { initCaptureUI, updateCaptureButtons, loadSavedRegionPreview, refreshCaptureUI } from './modules/capture-ui.js';
import {
  initOcrUI, startOcr, setOcrFolder, showValidationBanner, autoSaveCsv,
  isAutoOcrEnabled, isAutoValidationEnabled, isAutoSaveEnabled, refreshOcrUI,
} from './modules/ocr-ui.js';
import {
  initValidationUI, loadValidationList, validateCurrentResults,
  renderValidationOcrTable, renderValidationNames, renderCorrections,
  refreshValidationUI, onValidationTabOpened,
} from './modules/validation-ui.js';
import { initHistoryUI, loadHistory, refreshHistoryUI } from './modules/history-ui.js';
import { initTabs, switchToTab } from './modules/tab-manager.js';
import { initLogUI } from './modules/log-ui.js';
import { initEngineSelector, setActiveEngine, getActiveEngine } from './modules/engine-selector-ui.js';
import { initOllamaUi, getSelectedModelId } from './modules/ollama-ui.js';

// ─── Language Selector ─────────────────────────────────────────────────────

const appLanguageSelect = $('#appLanguageSelect');

appLanguageSelect.addEventListener('change', () => {
  window.i18n.setLanguage(appLanguageSelect.value);
  refreshAllDynamicUI();
  saveCurrentConfig();
});

/** Refresh all dynamic UI elements after a language change. */
function refreshAllDynamicUI() {
  refreshBrowserUI();
  refreshCaptureUI();
  refreshOcrUI();
  refreshValidationUI();
  refreshHistoryUI();
}

// ─── Module Initialization ─────────────────────────────────────────────────

initTabs({
  onValidation: () => onValidationTabOpened(),
  onHistory: () => loadHistory(),
});

initLogUI();

initBrowserUI({
  saveConfig: saveCurrentConfig,
  onBrowserReady: () => {
    $('#btnSelectRegion').disabled = false;
    $('#btnSelectEventRegion').disabled = false;
    updateCaptureButtons('member');
    updateCaptureButtons('event');
    if (state.currentRegion) loadSavedRegionPreview('member');
    if (state.eventRegion) loadSavedRegionPreview('event');
  },
  onBrowserClosed: () => {
    $('#btnSelectRegion').disabled = true;
    $('#btnTestScroll').disabled = true;
    $('#btnStartCapture').disabled = true;
    $('#btnSelectEventRegion').disabled = true;
    $('#btnTestEventScroll').disabled = true;
    $('#btnStartEventCapture').disabled = true;
  },
});

initCaptureUI({
  saveConfig: saveCurrentConfig,
  onCaptureDone: async ({ mode, outputDir, count }) => {
    // Set OCR folder to the capture output
    setOcrFolder(mode, outputDir);
    // Auto-OCR if enabled
    if (isAutoOcrEnabled(mode) && count > 0) {
      await startOcr(mode, outputDir);
    }
  },
});

initOcrUI({
  saveConfig: saveCurrentConfig,
  onOcrDone: async ({ mode }) => {
    // Auto-validation
    if (isAutoValidationEnabled(mode) && state.validationKnownNames.length > 0) {
      if (mode === 'event') state.validationMode = 'event';
      await validateCurrentResults();
      showValidationBanner(mode);
      // Auto-save if validation has no errors
      if (isAutoSaveEnabled(mode)) {
        if (mode === 'member' && state.validatedMembers) {
          const hasErrors = state.validatedMembers.some(m =>
            m.validationStatus === 'unknown' || m.validationStatus === 'suggested'
          );
          if (!hasErrors) await autoSaveCsv('member');
        } else if (mode === 'event') {
          await autoSaveCsv('event');
        }
      }
    }
  },
});

initValidationUI({ saveConfig: saveCurrentConfig });
initHistoryUI();

initEngineSelector((engine) => {
  if (engine === 'vision') initOllamaUi();
  saveCurrentConfig();
});

// ─── App Initialization ────────────────────────────────────────────────────

(async () => {
  try {
    await loadValidationList();
    await loadAndRestoreConfig();
    window.i18n.applyTranslations();
  } catch (err) {
    console.error('App-Initialisierung fehlgeschlagen:', err);
  }
})();
