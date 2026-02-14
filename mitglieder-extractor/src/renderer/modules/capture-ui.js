/**
 * Unified capture UI for both member and event modes.
 * Eliminates duplication by parameterizing DOM elements and API calls per mode.
 * @module modules/capture-ui
 */

import { $, t, escapeHtml, switchToSubTab, formatRegion } from '../utils/helpers.js';
import state from './state.js';
import { showLightbox } from '../components/lightbox.js';
import { showConfirmDialog } from '../components/confirm-dialog.js';
import { switchToTab } from './tab-manager.js';

/**
 * DOM element descriptors for each capture mode.
 * Both modes use the same property names, enabling a single set of functions.
 */
const MODE_DOM = {
  member: {
    regionBtn:       () => $('#btnSelectRegion'),
    regionInfo:      () => $('#regionInfo'),
    previewContainer:() => $('#regionPreviewContainer'),
    preview:         () => $('#regionPreview'),
    scrollDistance:     () => $('#scrollDistance'),
    scrollDistanceVal: () => $('#scrollDistanceValue'),
    scrollDelay:     () => $('#scrollDelay'),
    scrollDelayVal:  () => $('#scrollDelayValue'),
    testBtn:         () => $('#btnTestScroll'),
    testInfo:        () => $('#testInfo'),
    testContainer:   () => $('#testPreviewContainer'),
    testBefore:      () => $('#testBefore'),
    testAfter:       () => $('#testAfter'),
    maxScreenshots:  () => $('#maxScreenshots'),
    outputDir:       () => $('#outputDir'),
    browseBtn:       () => $('#btnBrowseDir'),
    openDirBtn:      () => $('#btnOpenOutputDir'),
    startBtn:        () => $('#btnStartCapture'),
    stopBtn:         () => $('#btnStopCapture'),
    progressWrap:    () => $('#progressContainer'),
    progressFill:    () => $('#progressFill'),
    progressText:    () => $('#progressText'),
    gallerySection:  () => $('#gallerySection'),
    gallery:         () => $('#gallery'),
    openFolderBtn:   () => $('#btnOpenFolder'),
    deleteBtn:       () => $('#btnDeleteCapture'),
    captureResult:   () => $('#captureResult'),
  },
  event: {
    regionBtn:       () => $('#btnSelectEventRegion'),
    regionInfo:      () => $('#eventRegionInfo'),
    previewContainer:() => $('#eventRegionPreviewContainer'),
    preview:         () => $('#eventRegionPreview'),
    scrollDistance:     () => $('#eventScrollDistance'),
    scrollDistanceVal: () => $('#eventScrollDistanceValue'),
    scrollDelay:     () => $('#eventScrollDelay'),
    scrollDelayVal:  () => $('#eventScrollDelayValue'),
    testBtn:         () => $('#btnTestEventScroll'),
    testInfo:        () => $('#eventTestInfo'),
    testContainer:   () => $('#eventTestPreviewContainer'),
    testBefore:      () => $('#eventTestBefore'),
    testAfter:       () => $('#eventTestAfter'),
    maxScreenshots:  () => $('#eventMaxScreenshots'),
    outputDir:       () => $('#eventOutputDir'),
    browseBtn:       () => $('#btnBrowseEventDir'),
    openDirBtn:      () => $('#btnOpenEventOutputDir'),
    startBtn:        () => $('#btnStartEventCapture'),
    stopBtn:         () => $('#btnStopEventCapture'),
    progressWrap:    () => $('#eventProgressContainer'),
    progressFill:    () => $('#eventProgressFill'),
    progressText:    () => $('#eventProgressText'),
    gallerySection:  () => $('#eventGallerySection'),
    gallery:         () => $('#eventGallery'),
    openFolderBtn:   () => $('#btnOpenEventFolder'),
    deleteBtn:       () => $('#btnDeleteEventCapture'),
    captureResult:   () => $('#eventCaptureResult'),
  },
};

/** Resolve lazy getters to actual DOM elements for a mode. */
function getDom(mode) {
  const desc = MODE_DOM[mode];
  const dom = {};
  for (const [key, getter] of Object.entries(desc)) {
    dom[key] = getter();
  }
  return dom;
}

/** State key helpers per mode. */
function getRegion(mode) { return mode === 'event' ? state.eventRegion : state.currentRegion; }
function setRegion(mode, val) { if (mode === 'event') state.eventRegion = val; else state.currentRegion = val; }
function getCapturing(mode) { return mode === 'event' ? state.eventCapturing : state.capturing; }
function setCapturing(mode, val) { if (mode === 'event') state.eventCapturing = val; else state.capturing = val; }
function getLastDir(mode) { return mode === 'event' ? state.eventLastOutputDir : state.lastOutputDir; }
function setLastDir(mode, val) { if (mode === 'event') state.eventLastOutputDir = val; else state.lastOutputDir = val; }

/** API methods per mode. */
const API = {
  member: {
    selectRegion: () => window.api.selectRegion(),
    previewRegion: (r) => window.api.previewRegion(r),
    testScroll: (o) => window.api.testScroll(o),
    startCapture: (o) => window.api.startCapture(o),
    stopCapture: () => window.api.stopCapture(),
    onProgress: (cb) => window.api.onCaptureProgress(cb),
    onDone: (cb) => window.api.onCaptureDone(cb),
  },
  event: {
    selectRegion: () => window.api.selectEventRegion(),
    previewRegion: (r) => window.api.previewEventRegion(r),
    testScroll: (o) => window.api.testEventScroll(o),
    startCapture: (o) => window.api.startEventCapture(o),
    stopCapture: () => window.api.stopEventCapture(),
    onProgress: (cb) => window.api.onEventCaptureProgress(cb),
    onDone: (cb) => window.api.onEventCaptureDone(cb),
  },
};

/**
 * Initialize capture UI for a single mode.
 * @param {string} mode - 'member' or 'event'.
 * @param {Object} deps
 * @param {Function} deps.saveConfig - Persist current config.
 * @param {Function} deps.onCaptureDone - Called with { mode, outputDir, count } when capture finishes.
 */
function initCaptureMode(mode, { saveConfig, onCaptureDone }) {
  const dom = getDom(mode);
  const api = API[mode];

  // Region selection
  dom.regionBtn.addEventListener('click', async () => {
    dom.regionBtn.disabled = true;
    dom.regionInfo.textContent = t('status.selectInBrowser');
    const result = await api.selectRegion();
    dom.regionBtn.disabled = false;
    if (result.ok) {
      setRegion(mode, result.region);
      const r = result.region;
      dom.regionInfo.textContent = formatRegion(r);
      if (result.preview) {
        dom.preview.src = `data:image/png;base64,${result.preview}`;
        dom.previewContainer.style.display = 'block';
      }
      updateCaptureButtons(mode);
      saveConfig();
    } else {
      dom.regionInfo.textContent = t('status.error', { error: result.error });
    }
  });

  // Slider listeners
  dom.scrollDistance.addEventListener('input', () => {
    dom.scrollDistanceVal.textContent = dom.scrollDistance.value;
  });
  dom.scrollDistance.addEventListener('change', saveConfig);
  dom.scrollDelay.addEventListener('input', () => {
    dom.scrollDelayVal.textContent = dom.scrollDelay.value;
  });
  dom.scrollDelay.addEventListener('change', saveConfig);
  dom.maxScreenshots.addEventListener('change', saveConfig);
  dom.outputDir.addEventListener('change', saveConfig);

  // Browse and open dir
  dom.browseBtn.addEventListener('click', async () => {
    const result = await window.api.browseFolder();
    if (result.ok) {
      dom.outputDir.value = result.path;
      saveConfig();
    }
  });
  dom.openDirBtn.addEventListener('click', () => {
    window.api.openFolder(dom.outputDir.value);
  });

  // Test scroll (calibration)
  dom.testBtn.addEventListener('click', async () => {
    const region = getRegion(mode);
    if (!region) return;
    dom.testBtn.disabled = true;
    dom.testInfo.textContent = t('status.scrolling');
    const result = await api.testScroll({
      region,
      scrollDistance: parseInt(dom.scrollDistance.value),
      scrollDelay: parseInt(dom.scrollDelay.value),
    });
    dom.testBtn.disabled = false;
    if (result.ok) {
      const diff = ((1 - result.similarity) * 100).toFixed(1);
      dom.testInfo.textContent = t('status.difference', { pct: diff });
      dom.testBefore.src = `data:image/png;base64,${result.before}`;
      dom.testAfter.src = `data:image/png;base64,${result.after}`;
      dom.testContainer.style.display = 'flex';
    } else {
      dom.testInfo.textContent = t('status.error', { error: result.error });
    }
  });

  // Start capture
  dom.startBtn.addEventListener('click', async () => {
    const region = getRegion(mode);
    if (!region || !state.browserReady) return;
    setCapturing(mode, true);
    dom.startBtn.disabled = true;
    dom.stopBtn.disabled = false;
    dom.progressWrap.style.display = 'flex';
    dom.progressFill.style.width = '0%';
    dom.progressText.textContent = '0 / ' + dom.maxScreenshots.value;
    dom.gallery.innerHTML = '';
    dom.gallerySection.style.display = 'block';
    dom.captureResult.textContent = '';
    switchToTab('capture');
    if (mode === 'event') {
      switchToSubTab('#captureSubTabBar', 'capture-event');
    }
    setTimeout(() => dom.gallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    saveConfig();
    await api.startCapture({
      region,
      scrollDistance: parseInt(dom.scrollDistance.value),
      scrollDelay: parseInt(dom.scrollDelay.value),
      maxScreenshots: parseInt(dom.maxScreenshots.value),
      outputDir: dom.outputDir.value,
    });
  });

  // Stop capture
  dom.stopBtn.addEventListener('click', async () => {
    await api.stopCapture();
    dom.stopBtn.disabled = true;
  });

  // Progress listener
  api.onProgress((data) => {
    const max = data.max || parseInt(dom.maxScreenshots.value);
    const pct = Math.round((data.count / max) * 100);
    dom.progressFill.style.width = pct + '%';
    dom.progressText.textContent = `${data.count} / ${max}`;
    if (data.thumbnail && data.status === 'capturing') {
      const item = document.createElement('div');
      item.className = 'gallery-item';
      const img = document.createElement('img');
      img.src = `data:image/png;base64,${data.thumbnail}`;
      img.alt = data.filename;
      const label = document.createElement('span');
      label.className = 'gallery-label';
      label.textContent = data.filename;
      item.appendChild(img);
      item.appendChild(label);
      item.addEventListener('click', () => showLightbox(`data:image/png;base64,${data.thumbnail}`));
      dom.gallery.appendChild(item);
      dom.gallery.scrollTop = dom.gallery.scrollHeight;
    }
    if (data.status === 'end-detected') {
      while (dom.gallery.children.length > data.count) {
        dom.gallery.removeChild(dom.gallery.lastChild);
      }
      dom.progressText.textContent = `${data.count} / ${max}`;
      dom.captureResult.textContent = t('status.listEndDetected', { count: data.count });
    }
  });

  // Done listener
  api.onDone((data) => {
    setCapturing(mode, false);
    dom.startBtn.disabled = false;
    dom.stopBtn.disabled = true;
    setLastDir(mode, data.outputDir);
    dom.captureResult.textContent = t('status.captureComplete', { count: data.count, dir: data.outputDir });
    dom.progressFill.style.width = '100%';
    onCaptureDone({ mode, outputDir: data.outputDir, count: data.count });
  });

  // Open last capture folder
  dom.openFolderBtn.addEventListener('click', () => {
    const dir = getLastDir(mode);
    if (dir) window.api.openFolder(dir);
  });

  // Delete last capture
  dom.deleteBtn.addEventListener('click', async () => {
    const dir = getLastDir(mode);
    if (!dir) return;
    if (!(await showConfirmDialog(t('confirm.deleteCapture', { path: dir })))) return;
    const result = await window.api.deleteFolder(dir);
    if (result.ok) {
      dom.gallerySection.style.display = 'none';
      dom.gallery.innerHTML = '';
      dom.captureResult.textContent = '';
      setLastDir(mode, null);
    }
  });
}

/**
 * Update capture button enabled states for a mode.
 * @param {string} mode - 'member' or 'event'.
 */
export function updateCaptureButtons(mode) {
  const dom = getDom(mode);
  const region = getRegion(mode);
  const ready = state.browserReady && region;
  dom.testBtn.disabled = !ready;
  dom.startBtn.disabled = !ready || getCapturing(mode);
}

/**
 * Load a fresh preview for a saved region.
 * @param {string} mode - 'member' or 'event'.
 */
export async function loadSavedRegionPreview(mode) {
  const region = getRegion(mode);
  if (!region || !state.browserReady) return;
  const dom = getDom(mode);
  const r = region;
  dom.regionInfo.textContent = t('status.loadingPreview', { w: r.width, h: r.height, x: r.x, y: r.y });
  const api = API[mode];
  const result = await api.previewRegion(region);
  if (result.ok) {
    dom.preview.src = `data:image/png;base64,${result.preview}`;
    dom.previewContainer.style.display = 'block';
    dom.regionInfo.textContent = t('status.regionSaved', { w: r.width, h: r.height, x: r.x, y: r.y });
  } else {
    dom.regionInfo.textContent = t('status.previewFailed', { w: r.width, h: r.height, x: r.x, y: r.y });
  }
}

/** Refresh dynamic i18n texts for capture UI. */
export function refreshCaptureUI() {
  for (const mode of ['member', 'event']) {
    const region = getRegion(mode);
    if (!region) {
      const dom = getDom(mode);
      dom.regionInfo.textContent = t('status.noRegion');
    }
  }
}

/**
 * Initialize capture UI for both modes.
 * @param {Object} deps
 * @param {Function} deps.saveConfig - Persist current config.
 * @param {Function} deps.onCaptureDone - Called when a capture finishes.
 */
export function initCaptureUI(deps) {
  initCaptureMode('member', deps);
  initCaptureMode('event', deps);
}
