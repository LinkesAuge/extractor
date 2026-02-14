/**
 * OCR engine selector: toggles between Tesseract, Vision Model, and Hybrid.
 * Controls visibility of engine-specific settings sections.
 * @module modules/engine-selector-ui
 */

import { $, t } from '../utils/helpers.js';

/** Engines that require the Vision/Ollama settings panel. */
const VISION_ENGINES = new Set(['vision', 'hybrid']);

/**
 * Initialize the engine selector radio buttons.
 * @param {Function} onEngineChange - Callback when engine changes: (engine: 'tesseract' | 'vision' | 'hybrid').
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
 * @param {'tesseract' | 'vision' | 'hybrid'} engine
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
 * @returns {'tesseract' | 'vision' | 'hybrid'}
 */
export function getActiveEngine() {
  const checked = document.querySelector('input[name="ocr-engine"]:checked');
  return checked?.value || 'tesseract';
}

/**
 * Toggle visibility of Tesseract-specific vs. Vision-specific settings.
 * Both Vision and Hybrid need the Ollama/model settings panel.
 * @param {'tesseract' | 'vision' | 'hybrid'} engine
 */
function toggleEngineSettings(engine) {
  const tesseractSettings = $('#tesseract-settings');
  const visionSettings = $('#vision-settings');
  if (tesseractSettings) tesseractSettings.style.display = engine === 'tesseract' ? '' : 'none';
  if (visionSettings) visionSettings.style.display = VISION_ENGINES.has(engine) ? '' : 'none';
}
