/**
 * Configuration management: load and persist user settings.
 * Reads DOM values directly via selectors to avoid coupling with other modules.
 * @module modules/config
 */

import { $, t, formatRegion, updateToggleText } from '../utils/helpers.js';
import state from './state.js';
import { getOcrSettings } from './ocr-ui.js';
import { getActiveEngine, setActiveEngine } from './engine-selector-ui.js';
import { getSelectedModelId, initOllamaUi } from './ollama-ui.js';

/**
 * Save the current configuration to disk via the main process.
 * Reads all relevant DOM values and state to build the config object.
 */
export async function saveCurrentConfig() {
  const engine = getActiveEngine();
  await window.api.saveConfig({
    language: window.i18n.getLanguage(),
    region: state.currentRegion,
    scrollDistance: parseInt($('#scrollDistance').value),
    scrollDelay: parseInt($('#scrollDelay').value),
    maxScreenshots: parseInt($('#maxScreenshots').value),
    outputDir: $('#outputDir').value,
    autoLogin: $('#autoLoginEnabled').checked,
    loginEmail: $('#loginEmail').value,
    loginPassword: $('#loginPassword').value,
    autoOcr: $('#autoOcrEnabled').checked,
    autoValidation: $('#autoValidationEnabled').checked,
    ocrFolder: $('#ocrFolder').value,
    ocrSettings: getOcrSettings('member'),
    // Advanced OCR (Vision Model)
    ocrEngine: engine,
    ollamaModel: engine === 'vision' ? getSelectedModelId() : undefined,
    // Quality check thresholds
    scoreOutlierThreshold: parseFloat($('#scoreOutlierThreshold').value),
    scoreChangeThreshold: parseFloat($('#scoreChangeThreshold').value),
    // Event settings
    eventRegion: state.eventRegion,
    eventScrollDistance: parseInt($('#eventScrollDistance').value),
    eventScrollDelay: parseInt($('#eventScrollDelay').value),
    eventMaxScreenshots: parseInt($('#eventMaxScreenshots').value),
    eventOutputDir: $('#eventOutputDir').value,
    eventAutoOcr: $('#eventAutoOcrEnabled').checked,
    eventAutoValidation: $('#eventAutoValidationEnabled').checked,
    eventOcrFolder: $('#eventOcrFolder').value,
    eventOcrSettings: getOcrSettings('event'),
  });
}

/**
 * Load configuration from disk and restore all UI elements.
 * Called once during app initialization.
 */
export async function loadAndRestoreConfig() {
  const result = await window.api.loadConfig();
  if (!result.ok || !result.config) return;
  const c = result.config;

  // Language (before translations are applied)
  if (c.language && (c.language === 'de' || c.language === 'en')) {
    window.i18n.setLanguage(c.language);
    $('#appLanguageSelect').value = c.language;
  }

  // Member capture
  restoreRegion(c.region, '#regionInfo', 'currentRegion');
  restoreSlider(c.scrollDistance, '#scrollDistance', '#scrollDistanceValue');
  restoreSlider(c.scrollDelay, '#scrollDelay', '#scrollDelayValue');
  if (c.maxScreenshots) $('#maxScreenshots').value = c.maxScreenshots;
  if (c.outputDir) $('#outputDir').value = c.outputDir;

  // Login
  if (c.loginEmail) $('#loginEmail').value = c.loginEmail;
  if (c.loginPassword) $('#loginPassword').value = c.loginPassword;
  if (c.autoLogin) {
    $('#autoLoginEnabled').checked = true;
    $('#loginFields').style.display = 'block';
    updateToggleText($('#autoLoginEnabled'), $('#autoLoginToggleText'));
  }

  // Member toggles
  restoreToggle(c.autoOcr, '#autoOcrEnabled', '#autoOcrToggleText');
  restoreToggle(c.autoValidation, '#autoValidationEnabled', '#autoValidationToggleText');
  if (c.ocrFolder) $('#ocrFolder').value = c.ocrFolder;

  // Member OCR settings
  if (c.ocrSettings) restoreOcrSettings(c.ocrSettings, 'member');

  // Event capture
  restoreRegion(c.eventRegion, '#eventRegionInfo', 'eventRegion');
  restoreSlider(c.eventScrollDistance, '#eventScrollDistance', '#eventScrollDistanceValue');
  restoreSlider(c.eventScrollDelay, '#eventScrollDelay', '#eventScrollDelayValue');
  if (c.eventMaxScreenshots) $('#eventMaxScreenshots').value = c.eventMaxScreenshots;
  if (c.eventOutputDir) $('#eventOutputDir').value = c.eventOutputDir;
  if (c.eventOcrFolder) $('#eventOcrFolder').value = c.eventOcrFolder;

  // Event toggles
  restoreToggle(c.eventAutoOcr, '#eventAutoOcrEnabled', '#eventAutoOcrToggleText');
  restoreToggle(c.eventAutoValidation, '#eventAutoValidationEnabled', '#eventAutoValidationToggleText');

  // Event OCR settings
  if (c.eventOcrSettings) restoreOcrSettings(c.eventOcrSettings, 'event');
  // Advanced OCR engine
  if (c.ocrEngine) {
    setActiveEngine(c.ocrEngine);
    if (c.ocrEngine === 'vision') initOllamaUi(c.ollamaModel || null);
  }
  // Quality check thresholds
  if (c.scoreOutlierThreshold != null) {
    $('#scoreOutlierThreshold').value = c.scoreOutlierThreshold;
    $('#scoreOutlierThresholdValue').textContent = Math.round(c.scoreOutlierThreshold * 100) + '%';
  }
  if (c.scoreChangeThreshold != null) {
    $('#scoreChangeThreshold').value = c.scoreChangeThreshold;
    $('#scoreChangeThresholdValue').textContent = Math.round(c.scoreChangeThreshold * 100) + '%';
  }
}

// ─── Private Helpers ────────────────────────────────────────────────────────

/** Restore a region from config into state and info element. */
function restoreRegion(region, infoSel, stateKey) {
  if (!region) return;
  state[stateKey] = region;
  $(infoSel).textContent = formatRegion(region);
}

/** Restore a slider value and its display element. */
function restoreSlider(value, sliderSel, displaySel) {
  if (value == null) return;
  $(sliderSel).value = value;
  $(displaySel).textContent = value;
}

/** Restore a toggle checkbox (only if explicitly false). */
function restoreToggle(value, checkboxSel, textSel) {
  if (value === false) {
    $(checkboxSel).checked = false;
    updateToggleText($(checkboxSel), $(textSel));
  }
}

/** Restore OCR settings for a mode. */
function restoreOcrSettings(settings, mode) {
  const s = settings;

  if (s.scale != null) {
    const scaleId = mode === 'event' ? 'eventOcrScale' : 'ocrScale';
    const scaleValId = mode === 'event' ? 'eventOcrScaleValue' : 'ocrScaleValue';
    $(`#${scaleId}`).value = s.scale;
    $(`#${scaleValId}`).textContent = s.scale + 'x';
  }
  if (s.greyscale != null) {
    const cbId = mode === 'event' ? 'eventOcrGreyscale' : 'ocrGreyscale';
    const textId = mode === 'event' ? 'eventOcrGreyscaleText' : 'ocrGreyscaleText';
    $(`#${cbId}`).checked = s.greyscale;
    updateToggleText($(`#${cbId}`), $(`#${textId}`));
  }
  if (s.sharpen != null) {
    const id = mode === 'event' ? 'eventOcrSharpen' : 'ocrSharpen';
    const valId = mode === 'event' ? 'eventOcrSharpenValue' : 'ocrSharpenValue';
    $(`#${id}`).value = s.sharpen;
    $(`#${valId}`).textContent = s.sharpen;
  }
  if (s.contrast != null) {
    const id = mode === 'event' ? 'eventOcrContrast' : 'ocrContrast';
    const valId = mode === 'event' ? 'eventOcrContrastValue' : 'ocrContrastValue';
    $(`#${id}`).value = s.contrast;
    $(`#${valId}`).textContent = s.contrast;
  }
  if (s.threshold != null) {
    const cbId = mode === 'event' ? 'eventOcrThresholdEnabled' : 'ocrThresholdEnabled';
    const textId = mode === 'event' ? 'eventOcrThresholdText' : 'ocrThresholdText';
    const sliderId = mode === 'event' ? 'eventOcrThresholdVal' : 'ocrThresholdVal';
    const dispId = mode === 'event' ? 'eventOcrThresholdDisplay' : 'ocrThresholdDisplay';
    if (s.threshold > 0) {
      $(`#${cbId}`).checked = true;
      updateToggleText($(`#${cbId}`), $(`#${textId}`));
      $(`#${sliderId}`).disabled = false;
      $(`#${sliderId}`).value = s.threshold;
      $(`#${dispId}`).textContent = s.threshold;
    } else {
      $(`#${cbId}`).checked = false;
      updateToggleText($(`#${cbId}`), $(`#${textId}`));
      $(`#${sliderId}`).disabled = true;
    }
  }
  if (s.psm != null) {
    const id = mode === 'event' ? 'eventOcrPsm' : 'ocrPsm';
    $(`#${id}`).value = s.psm;
  }
  if (s.lang) {
    const id = mode === 'event' ? 'eventOcrLang' : 'ocrLang';
    $(`#${id}`).value = s.lang;
  }
  if (s.minScore != null) {
    const id = mode === 'event' ? 'eventOcrMinScore' : 'ocrMinScore';
    $(`#${id}`).value = s.minScore;
  }
}
