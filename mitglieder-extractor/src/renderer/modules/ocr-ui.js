/**
 * Unified OCR UI for both member and event modes.
 * Handles OCR start/stop, settings sliders, results display, and auto-save.
 * @module modules/ocr-ui
 */

import { $, t, escapeHtml, localDateString, getRankClass, switchToSubTab, updateToggleText } from '../utils/helpers.js';
import state from './state.js';
import { switchToTab } from './tab-manager.js';
import { getActiveEngine } from './engine-selector-ui.js';
import { getSelectedModelId } from './ollama-ui.js';

/**
 * DOM element descriptors for each OCR mode.
 */
const MODE_DOM = {
  member: {
    autoOcr:         () => $('#autoOcrEnabled'),
    autoOcrText:     () => $('#autoOcrToggleText'),
    autoValidation:  () => $('#autoValidationEnabled'),
    autoValidationText: () => $('#autoValidationToggleText'),
    autoSave:        () => $('#autoSaveEnabled'),
    autoSaveText:    () => $('#autoSaveToggleText'),
    banner:          () => $('#ocrValidationBanner'),
    bannerIcon:      () => $('#ocrValidationIcon'),
    bannerMsg:       () => $('#ocrValidationMsg'),
    bannerBtn:       () => $('#btnGoToValidation'),
    folderInput:     () => $('#ocrFolder'),
    browseBtn:       () => $('#btnBrowseOcrFolder'),
    openBtn:         () => $('#btnOpenOcrFolder'),
    startBtn:        () => $('#btnStartOcr'),
    stopBtn:         () => $('#btnStopOcr'),
    status:          () => $('#ocrStatus'),
    progressWrap:    () => $('#ocrProgressContainer'),
    progressFill:    () => $('#ocrProgressFill'),
    progressText:    () => $('#ocrProgressText'),
    resultContainer: () => $('#ocrResultContainer'),
    resultCount:     () => $('#ocrResultCount'),
    tableBody:       () => $('#ocrTableBody'),
    exportBtn:       () => $('#btnExportCsv'),
    section:         () => $('#auswertungSection'),
    // OCR settings
    scale:           () => $('#ocrScale'),
    scaleVal:        () => $('#ocrScaleValue'),
    greyscale:       () => $('#ocrGreyscale'),
    greyscaleText:   () => $('#ocrGreyscaleText'),
    sharpen:         () => $('#ocrSharpen'),
    sharpenVal:      () => $('#ocrSharpenValue'),
    contrast:        () => $('#ocrContrast'),
    contrastVal:     () => $('#ocrContrastValue'),
    thresholdOn:     () => $('#ocrThresholdEnabled'),
    thresholdText:   () => $('#ocrThresholdText'),
    thresholdVal:    () => $('#ocrThresholdVal'),
    thresholdDisp:   () => $('#ocrThresholdDisplay'),
    psm:             () => $('#ocrPsm'),
    lang:            () => $('#ocrLang'),
    minScore:        () => $('#ocrMinScore'),
  },
  event: {
    autoOcr:         () => $('#eventAutoOcrEnabled'),
    autoOcrText:     () => $('#eventAutoOcrToggleText'),
    autoValidation:  () => $('#eventAutoValidationEnabled'),
    autoValidationText: () => $('#eventAutoValidationToggleText'),
    autoSave:        () => $('#eventAutoSaveEnabled'),
    autoSaveText:    () => $('#eventAutoSaveToggleText'),
    banner:          () => $('#eventOcrValidationBanner'),
    bannerIcon:      () => $('#eventOcrValidationIcon'),
    bannerMsg:       () => $('#eventOcrValidationMsg'),
    bannerBtn:       () => $('#btnGoToEventValidation'),
    folderInput:     () => $('#eventOcrFolder'),
    browseBtn:       () => $('#btnBrowseEventOcrFolder'),
    openBtn:         () => $('#btnOpenEventOcrFolder'),
    startBtn:        () => $('#btnStartEventOcr'),
    stopBtn:         () => $('#btnStopEventOcr'),
    status:          () => $('#eventOcrStatus'),
    progressWrap:    () => $('#eventOcrProgressContainer'),
    progressFill:    () => $('#eventOcrProgressFill'),
    progressText:    () => $('#eventOcrProgressText'),
    resultContainer: () => $('#eventOcrResultContainer'),
    resultCount:     () => $('#eventOcrResultCount'),
    tableBody:       () => $('#eventOcrTableBody'),
    exportBtn:       () => $('#btnExportEventCsv'),
    section:         () => $('#eventAuswertungSection'),
    scale:           () => $('#eventOcrScale'),
    scaleVal:        () => $('#eventOcrScaleValue'),
    greyscale:       () => $('#eventOcrGreyscale'),
    greyscaleText:   () => $('#eventOcrGreyscaleText'),
    sharpen:         () => $('#eventOcrSharpen'),
    sharpenVal:      () => $('#eventOcrSharpenValue'),
    contrast:        () => $('#eventOcrContrast'),
    contrastVal:     () => $('#eventOcrContrastValue'),
    thresholdOn:     () => $('#eventOcrThresholdEnabled'),
    thresholdText:   () => $('#eventOcrThresholdText'),
    thresholdVal:    () => $('#eventOcrThresholdVal'),
    thresholdDisp:   () => $('#eventOcrThresholdDisplay'),
    psm:             () => $('#eventOcrPsm'),
    lang:            () => $('#eventOcrLang'),
    minScore:        () => $('#eventOcrMinScore'),
  },
};

/** Resolve lazy getters to DOM elements. */
function getDom(mode) {
  const desc = MODE_DOM[mode];
  const dom = {};
  for (const [key, getter] of Object.entries(desc)) {
    dom[key] = getter();
  }
  return dom;
}

/** API mapping per mode. */
const API = {
  member: {
    startOcr: (f, s) => window.api.startOcr(f, s),
    stopOcr: () => window.api.stopOcr(),
    exportCsv: (d, n) => window.api.exportCsv(d, n),
    autoSave: (d) => window.api.autoSaveCsv(d),
    onProgress: (cb) => window.api.onOcrProgress(cb),
    onDone: (cb) => window.api.onOcrDone(cb),
  },
  event: {
    startOcr: (f, s) => window.api.startEventOcr(f, s),
    stopOcr: () => window.api.stopEventOcr(),
    exportCsv: (d, n) => window.api.exportEventCsv(d, n),
    autoSave: (d) => window.api.autoSaveEventCsv(d),
    onProgress: (cb) => window.api.onEventOcrProgress(cb),
    onDone: (cb) => window.api.onEventOcrDone(cb),
  },
};

/** State helpers per mode. */
function getOcrRunning(mode) { return mode === 'event' ? state.eventOcrRunning : state.ocrRunning; }
function setOcrRunning(mode, val) { if (mode === 'event') state.eventOcrRunning = val; else state.ocrRunning = val; }
function getResults(mode) { return mode === 'event' ? state.eventOcrEntries : state.ocrMembers; }
function setResults(mode, val) { if (mode === 'event') state.eventOcrEntries = val; else state.ocrMembers = val; }

/**
 * Read OCR settings from the DOM for a given mode.
 * @param {string} mode - 'member' or 'event'.
 * @returns {Object} OCR settings object.
 */
export function getOcrSettings(mode) {
  const dom = getDom(mode);
  const engine = getActiveEngine();
  const settings = {
    engine,
    scale: parseFloat(dom.scale.value),
    greyscale: dom.greyscale.checked,
    sharpen: parseFloat(dom.sharpen.value),
    contrast: parseFloat(dom.contrast.value),
    threshold: dom.thresholdOn.checked ? parseInt(dom.thresholdVal.value) : 0,
    psm: parseInt(dom.psm.value),
    lang: dom.lang.value,
    minScore: parseInt(dom.minScore.value) || (mode === 'event' ? 5000 : 10000),
  };
  if (engine === 'vision') {
    settings.ollamaModel = getSelectedModelId();
  }
  return settings;
}

/**
 * Start OCR processing for a mode.
 * @param {string} mode - 'member' or 'event'.
 * @param {string} [folderPath] - Override folder path (from auto-capture).
 */
export async function startOcr(mode, folderPath) {
  const dom = getDom(mode);
  const api = API[mode];
  const folder = folderPath || dom.folderInput.value;
  if (!folder) {
    dom.status.textContent = t('status.noFolder');
    return;
  }
  // Guard: vision engine requires a model to be selected
  if (getActiveEngine() === 'vision' && !getSelectedModelId()) {
    dom.status.textContent = t('status.noModelSelected') || 'Bitte zuerst ein Vision-Modell auswaehlen.';
    return;
  }
  setOcrRunning(mode, true);
  setResults(mode, null);
  dom.startBtn.disabled = true;
  dom.stopBtn.disabled = false;
  dom.status.textContent = t('status.initOcr');
  dom.progressWrap.style.display = 'flex';
  dom.progressFill.style.width = '0%';
  dom.progressText.textContent = '0 / ?';
  dom.resultContainer.style.display = 'none';
  dom.tableBody.innerHTML = '';
  switchToTab('capture');
  if (mode === 'event') {
    switchToSubTab('#captureSubTabBar', 'capture-event');
  }
  setTimeout(() => dom.section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  const result = await api.startOcr(folder, getOcrSettings(mode));
  setOcrRunning(mode, false);
  dom.startBtn.disabled = false;
  dom.stopBtn.disabled = true;
  if (result.ok) {
    const count = mode === 'event' ? result.entries.length : result.members.length;
    const key = mode === 'event' ? 'status.eventMembersDetected' : 'status.membersDetected';
    dom.status.textContent = t(key, { count });
    dom.progressFill.style.width = '100%';
  } else {
    dom.status.textContent = t('status.error', { error: result.error });
  }
}

/**
 * Render OCR results in the results table.
 * @param {string} mode - 'member' or 'event'.
 * @param {Array} data - Array of parsed OCR entries.
 */
export function renderOcrResults(mode, data) {
  const dom = getDom(mode);
  dom.resultContainer.style.display = 'block';
  const countKey = mode === 'event' ? 'result.eventPlayersFound' : 'result.membersFound';
  dom.resultCount.textContent = t(countKey, { count: data.length });
  dom.tableBody.innerHTML = '';
  data.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    if (mode === 'event') {
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${entry.power.toLocaleString('de-DE')}</td>
        <td>${entry.eventPoints.toLocaleString('de-DE')}</td>
      `;
    } else {
      const rankClass = getRankClass(entry.rank);
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><span class="ocr-rank-badge ${rankClass}">${escapeHtml(entry.rank)}</span></td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.coords)}</td>
        <td>${entry.score.toLocaleString('de-DE')}</td>
      `;
    }
    dom.tableBody.appendChild(tr);
  });
}

/**
 * Show or hide the OCR validation banner for a mode.
 * @param {string} mode - 'member' or 'event'.
 */
export function showValidationBanner(mode) {
  const dom = getDom(mode);
  const autoEnabled = dom.autoValidation.checked;
  if (!state.validatedMembers || !autoEnabled) {
    dom.banner.style.display = 'none';
    return;
  }
  const counts = { confirmed: 0, corrected: 0, suggested: 0, unknown: 0 };
  state.validatedMembers.forEach(m => counts[m.validationStatus]++);
  const total = state.validatedMembers.length;
  const ok = counts.confirmed + counts.corrected;
  const errors = counts.suggested + counts.unknown;
  dom.banner.style.display = 'flex';
  if (errors === 0) {
    dom.banner.className = 'ocr-validation-banner banner-success';
    dom.bannerIcon.textContent = '\u2714';
    dom.bannerMsg.textContent = t('validation.bannerSuccess', { total });
    dom.bannerBtn.style.display = 'none';
    dom.status.textContent = t('status.allValidated', { total });
  } else if (counts.unknown > 0) {
    dom.banner.className = 'ocr-validation-banner banner-error';
    dom.bannerIcon.textContent = '\u2716';
    dom.bannerMsg.textContent = t('validation.bannerError', {
      errors, unknown: counts.unknown, suggested: counts.suggested, ok, total,
    });
    dom.bannerBtn.style.display = '';
    dom.status.textContent = t('status.validationErrors', { total, errors });
  } else {
    dom.banner.className = 'ocr-validation-banner banner-warning';
    dom.bannerIcon.textContent = '\u26A0';
    dom.bannerMsg.textContent = t('validation.bannerWarning', {
      suggested: counts.suggested, ok, total,
    });
    dom.bannerBtn.style.display = '';
    dom.status.textContent = t('status.validationSuggestions', { total, suggested: counts.suggested });
  }
}

/**
 * Auto-save OCR results as CSV.
 * @param {string} mode - 'member' or 'event'.
 */
export async function autoSaveCsv(mode) {
  const dom = getDom(mode);
  const api = API[mode];
  if (mode === 'event') {
    if (!state.eventOcrEntries || state.eventOcrEntries.length === 0) return;
    const result = await api.autoSave(state.eventOcrEntries);
    if (result.ok) {
      dom.status.textContent += ` ${t('status.eventCsvAutoSaved', { fileName: result.fileName })}`;
    }
  } else {
    if (!state.ocrMembers || state.ocrMembers.length === 0) return;
    const membersToSave = state.validatedMembers
      ? state.validatedMembers.map(m => ({ rank: m.rank, name: m.name, coords: m.coords, score: m.score }))
      : state.ocrMembers;
    const result = await api.autoSave(membersToSave);
    if (result.ok) {
      dom.status.textContent += ` ${t('status.csvAutoSaved', { fileName: result.fileName })}`;
    }
  }
}

/**
 * Initialize OCR settings slider event listeners for a mode.
 * @param {string} mode - 'member' or 'event'.
 * @param {Function} saveConfig - Persist current config.
 */
function initOcrSettings(mode, saveConfig) {
  const dom = getDom(mode);
  dom.scale.addEventListener('input', () => { dom.scaleVal.textContent = dom.scale.value + 'x'; });
  dom.scale.addEventListener('change', saveConfig);
  dom.greyscale.addEventListener('change', () => {
    updateToggleText(dom.greyscale, dom.greyscaleText);
    saveConfig();
  });
  dom.sharpen.addEventListener('input', () => { dom.sharpenVal.textContent = dom.sharpen.value; });
  dom.sharpen.addEventListener('change', saveConfig);
  dom.contrast.addEventListener('input', () => { dom.contrastVal.textContent = dom.contrast.value; });
  dom.contrast.addEventListener('change', saveConfig);
  dom.thresholdOn.addEventListener('change', () => {
    updateToggleText(dom.thresholdOn, dom.thresholdText);
    dom.thresholdVal.disabled = !dom.thresholdOn.checked;
    saveConfig();
  });
  dom.thresholdVal.addEventListener('input', () => {
    dom.thresholdDisp.textContent = dom.thresholdVal.value;
  });
  dom.thresholdVal.addEventListener('change', saveConfig);
  dom.psm.addEventListener('change', saveConfig);
  dom.lang.addEventListener('change', saveConfig);
  dom.minScore.addEventListener('change', saveConfig);
}

/**
 * Initialize OCR UI for a single mode.
 * @param {string} mode - 'member' or 'event'.
 * @param {Object} deps
 * @param {Function} deps.saveConfig - Persist config.
 * @param {Function} deps.onOcrDone - Called with { mode, data } when OCR finishes.
 */
function initOcrMode(mode, { saveConfig, onOcrDone }) {
  const dom = getDom(mode);
  const api = API[mode];

  // Toggle listeners
  dom.autoOcr.addEventListener('change', () => {
    updateToggleText(dom.autoOcr, dom.autoOcrText);
    saveConfig();
  });
  dom.autoValidation.addEventListener('change', () => {
    updateToggleText(dom.autoValidation, dom.autoValidationText);
    saveConfig();
  });
  dom.autoSave.addEventListener('change', () => {
    updateToggleText(dom.autoSave, dom.autoSaveText);
    saveConfig();
  });

  // Banner navigation
  dom.bannerBtn.addEventListener('click', () => {
    if (mode === 'event') {
      state.validationMode = 'event';
      switchToSubTab('validationModeSubTabBar', 'validation-mode-event');
    }
    switchToTab('validation');
  });

  // Folder browse/open
  dom.browseBtn.addEventListener('click', async () => {
    const defaultPath = dom.folderInput.value || (mode === 'event' ? './captures/events' : './captures/mitglieder');
    const result = await window.api.browseFolder({ title: t('dialog.selectOcrFolder'), defaultPath });
    if (result.ok) {
      dom.folderInput.value = result.path;
      saveConfig();
    }
  });
  dom.openBtn.addEventListener('click', () => {
    const folder = dom.folderInput.value;
    if (folder) window.api.openFolder(folder);
  });

  // Start/stop
  dom.startBtn.addEventListener('click', () => startOcr(mode));
  dom.stopBtn.addEventListener('click', async () => {
    await api.stopOcr();
    dom.stopBtn.disabled = true;
  });

  // Export
  dom.exportBtn.addEventListener('click', async () => {
    const data = getResults(mode);
    if (!data || data.length === 0) return;
    const prefix = mode === 'event' ? 'event' : 'mitglieder';
    const defaultName = `${prefix}_${localDateString()}.csv`;
    const result = await api.exportCsv(data, defaultName);
    if (result.ok) {
      const key = mode === 'event' ? 'status.eventCsvSaved' : 'status.csvSaved';
      dom.status.textContent = t(key, { path: result.path });
    }
  });

  // Progress listener
  api.onProgress((data) => {
    const pct = Math.round((data.current / data.total) * 100);
    dom.progressFill.style.width = pct + '%';
    dom.progressText.textContent = `${data.current} / ${data.total}`;
    dom.status.textContent = t('status.processing', { file: data.file });
  });

  // Done listener
  api.onDone((data) => {
    if (mode === 'event') {
      state.eventOcrEntries = data.entries;
      renderOcrResults('event', data.entries);
    } else {
      state.ocrMembers = data.members;
      state.validationMode = 'member';
      switchToSubTab('validationModeSubTabBar', 'validation-mode-member');
      renderOcrResults('member', data.members);
    }
    onOcrDone({ mode, data });
  });

  initOcrSettings(mode, saveConfig);
}

/** Refresh dynamic i18n texts for OCR UI. */
export function refreshOcrUI() {
  for (const mode of ['member', 'event']) {
    const dom = getDom(mode);
    updateToggleText(dom.autoOcr, dom.autoOcrText);
    updateToggleText(dom.autoValidation, dom.autoValidationText);
    updateToggleText(dom.autoSave, dom.autoSaveText);
    updateToggleText(dom.greyscale, dom.greyscaleText);
    updateToggleText(dom.thresholdOn, dom.thresholdText);
  }
  if (state.eventOcrEntries) renderOcrResults('event', state.eventOcrEntries);
  if (state.ocrMembers) renderOcrResults('member', state.ocrMembers);
  // Re-show validation banners (language change may affect banner text)
  if (state.validatedMembers) {
    showValidationBanner(state.validationMode);
  }
}

/**
 * Check whether auto-OCR is enabled for a mode.
 * @param {string} mode - 'member' or 'event'.
 * @returns {boolean} True if auto-OCR is checked.
 */
export function isAutoOcrEnabled(mode) {
  return getDom(mode).autoOcr.checked;
}

/**
 * Check whether auto-validation is enabled for a mode.
 * @param {string} mode - 'member' or 'event'.
 * @returns {boolean} True if auto-validation is checked.
 */
export function isAutoValidationEnabled(mode) {
  return getDom(mode).autoValidation.checked;
}

/**
 * Check whether auto-save is enabled for a mode.
 * @param {string} mode - 'member' or 'event'.
 * @returns {boolean} True if auto-save is checked.
 */
export function isAutoSaveEnabled(mode) {
  return getDom(mode).autoSave.checked;
}

/**
 * Set the OCR folder input value for a mode.
 * @param {string} mode - 'member' or 'event'.
 * @param {string} path - Folder path.
 */
export function setOcrFolder(mode, path) {
  getDom(mode).folderInput.value = path;
}

/**
 * Initialize OCR UI for both modes.
 * @param {Object} deps
 * @param {Function} deps.saveConfig - Persist config.
 * @param {Function} deps.onOcrDone - Called when OCR finishes.
 */
export function initOcrUI(deps) {
  initOcrMode('member', deps);
  initOcrMode('event', deps);
}
