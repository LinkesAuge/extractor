/**
 * OCR engine selector: toggles between Tesseract and Vision Model.
 * Controls visibility of engine-specific settings sections.
 * @module modules/engine-selector-ui
 */

import { $, t } from '../utils/helpers.js';

/**
 * Initialize the engine selector radio buttons.
 * @param {Function} onEngineChange - Callback when engine changes: (engine: 'tesseract' | 'vision').
 */
export function initEngineSelector(onEngineChange) {
  const radios = document.querySelectorAll('input[name="ocr-engine"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const engine = radio.value;
      toggleEngineSettings(engine);
      onEngineChange?.(engine);
    });
  });
}

/**
 * Set the active engine programmatically (e.g., from saved config).
 * @param {'tesseract' | 'vision'} engine
 */
export function setActiveEngine(engine) {
  const radio = document.querySelector(`input[name="ocr-engine"][value="${engine}"]`);
  if (radio) {
    radio.checked = true;
    toggleEngineSettings(engine);
  }
}

/**
 * Get the currently selected engine.
 * @returns {'tesseract' | 'vision'}
 */
export function getActiveEngine() {
  const checked = document.querySelector('input[name="ocr-engine"]:checked');
  return checked?.value || 'tesseract';
}

/**
 * Toggle visibility of Tesseract-specific vs. Vision-specific settings.
 * @param {'tesseract' | 'vision'} engine
 */
function toggleEngineSettings(engine) {
  const tesseractSettings = $('#tesseract-settings');
  const visionSettings = $('#vision-settings');
  if (tesseractSettings) tesseractSettings.style.display = engine === 'tesseract' ? '' : 'none';
  if (visionSettings) visionSettings.style.display = engine === 'vision' ? '' : 'none';
}
