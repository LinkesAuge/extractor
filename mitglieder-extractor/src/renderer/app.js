// ─── i18n Shortcut ──────────────────────────────────────────────────────────

const t = (key, vars) => window.i18n.t(key, vars);

// ─── DOM Elemente ───────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const urlInput = $('#urlInput');
const btnLaunch = $('#btnLaunch');
const btnClose = $('#btnClose');
const browserStatus = $('#browserStatus');

const btnSelectRegion = $('#btnSelectRegion');
const regionInfo = $('#regionInfo');
const regionPreviewContainer = $('#regionPreviewContainer');
const regionPreview = $('#regionPreview');

const scrollTicksSlider = $('#scrollTicks');
const scrollTicksValue = $('#scrollTicksValue');
const scrollDelaySlider = $('#scrollDelay');
const scrollDelayValue = $('#scrollDelayValue');
const btnTestScroll = $('#btnTestScroll');
const testInfo = $('#testInfo');
const testPreviewContainer = $('#testPreviewContainer');
const testBefore = $('#testBefore');
const testAfter = $('#testAfter');

const maxScreenshotsInput = $('#maxScreenshots');
const outputDirInput = $('#outputDir');
const btnBrowseDir = $('#btnBrowseDir');
const btnOpenOutputDir = $('#btnOpenOutputDir');
const btnStartCapture = $('#btnStartCapture');
const btnStopCapture = $('#btnStopCapture');
const progressContainer = $('#progressContainer');
const progressFill = $('#progressFill');
const progressText = $('#progressText');

const gallerySection = $('#gallerySection');
const gallery = $('#gallery');
const btnOpenFolder = $('#btnOpenFolder');
const btnDeleteCapture = $('#btnDeleteCapture');
const captureResult = $('#captureResult');

const autoLoginEnabled = $('#autoLoginEnabled');
const autoLoginToggleText = $('#autoLoginToggleText');
const loginFields = $('#loginFields');
const loginEmail = $('#loginEmail');
const loginPassword = $('#loginPassword');
const btnTogglePassword = $('#btnTogglePassword');

const logContainer = $('#logContainer');
const btnClearLog = $('#btnClearLog');

// OCR Auswertung
const autoOcrEnabled = $('#autoOcrEnabled');
const autoOcrToggleText = $('#autoOcrToggleText');
const autoValidationEnabled = $('#autoValidationEnabled');
const autoValidationToggleText = $('#autoValidationToggleText');
const autoSaveEnabled = $('#autoSaveEnabled');
const autoSaveToggleText = $('#autoSaveToggleText');
const ocrValidationBanner = $('#ocrValidationBanner');
const ocrValidationIcon = $('#ocrValidationIcon');
const ocrValidationMsg = $('#ocrValidationMsg');
const btnGoToValidation = $('#btnGoToValidation');
const ocrFolderInput = $('#ocrFolder');
const btnBrowseOcrFolder = $('#btnBrowseOcrFolder');
const btnStartOcr = $('#btnStartOcr');
const btnStopOcr = $('#btnStopOcr');
const ocrStatus = $('#ocrStatus');
const ocrProgressContainer = $('#ocrProgressContainer');
const ocrProgressFill = $('#ocrProgressFill');
const ocrProgressText = $('#ocrProgressText');
const ocrResultContainer = $('#ocrResultContainer');
const ocrResultCount = $('#ocrResultCount');
const ocrTableBody = $('#ocrTableBody');
const btnExportCsv = $('#btnExportCsv');
const auswertungSection = $('#auswertungSection');

// Validierung
const validationSummary = $('#validationSummary');
const validationEmptyHint = $('#validationEmptyHint');
const validationContent = $('#validationContent');
const validationOcrBody = $('#validationOcrBody');
const validationSearch = $('#validationSearch');
const validationNamesList = $('#validationNamesList');
const validationNameCount = $('#validationNameCount');
const correctionsList = $('#correctionsList');
const correctionCount = $('#correctionCount');
const btnAcceptAllSuggestions = $('#btnAcceptAllSuggestions');
const btnAddValidationName = $('#btnAddValidationName');
const btnImportValidation = $('#btnImportValidation');
const btnExportValidation = $('#btnExportValidation');
const btnRevalidate = $('#btnRevalidate');
const validationFilterBtns = $$('.validation-filter-btn');

// OCR Einstellungen
const ocrScaleSlider = $('#ocrScale');
const ocrScaleValue = $('#ocrScaleValue');
const ocrGreyscaleCheckbox = $('#ocrGreyscale');
const ocrGreyscaleText = $('#ocrGreyscaleText');
const ocrSharpenSlider = $('#ocrSharpen');
const ocrSharpenValue = $('#ocrSharpenValue');
const ocrContrastSlider = $('#ocrContrast');
const ocrContrastValue = $('#ocrContrastValue');
const ocrThresholdEnabled = $('#ocrThresholdEnabled');
const ocrThresholdText = $('#ocrThresholdText');
const ocrThresholdValSlider = $('#ocrThresholdVal');
const ocrThresholdDisplay = $('#ocrThresholdDisplay');
const ocrPsmSelect = $('#ocrPsm');
const ocrLangSelect = $('#ocrLang');
const ocrMinScoreInput = $('#ocrMinScore');

// History
const historyEmptyHint = $('#historyEmptyHint');
const historyListContainer = $('#historyListContainer');
const historyListBody = $('#historyListBody');
const historyDetailSection = $('#historyDetailSection');
const historyDetailTitle = $('#historyDetailTitle');
const historyDetailCount = $('#historyDetailCount');
const historyDetailBody = $('#historyDetailBody');
const btnRefreshHistory = $('#btnRefreshHistory');
const btnOpenResultsDir = $('#btnOpenResultsDir');
const btnHistoryExportCsv = $('#btnHistoryExportCsv');

// Language
const appLanguageSelect = $('#appLanguageSelect');

// Tab Navigation
const tabBtns = $$('.tab-btn');
const tabContents = $$('.tab-content');

// ─── State ──────────────────────────────────────────────────────────────────

let currentRegion = null;
let browserReady = false;
let capturing = false;
let lastOutputDir = null;
let autoLoginAttempted = false;
let ocrRunning = false;
let ocrMembers = null;  // letzte OCR-Ergebnisse
let validatedMembers = null;  // OCR-Ergebnisse mit Validierungsstatus
let validationKnownNames = [];
let validationCorrections = {};
let selectedOcrRow = null;  // Index des ausgewaehlten OCR-Eintrags fuer Zuordnung
let validationFilter = 'all';
let historyEntries = [];
let selectedHistoryFile = null;
let historyMembers = null;

// ─── Init: Config laden ─────────────────────────────────────────────────────

(async () => {
  // Validierungsliste immer laden
  loadValidationList();

  const result = await window.api.loadConfig();
  if (result.ok && result.config) {
    const c = result.config;

    // Sprache wiederherstellen (vor applyTranslations)
    if (c.language && (c.language === 'de' || c.language === 'en')) {
      window.i18n.setLanguage(c.language);
      appLanguageSelect.value = c.language;
    }

    if (c.region) {
      currentRegion = c.region;
      regionInfo.textContent = `${c.region.width} x ${c.region.height} @ (${c.region.x}, ${c.region.y})`;
    }
    if (c.scrollTicks) {
      scrollTicksSlider.value = c.scrollTicks;
      scrollTicksValue.textContent = c.scrollTicks;
    }
    if (c.scrollDelay) {
      scrollDelaySlider.value = c.scrollDelay;
      scrollDelayValue.textContent = c.scrollDelay;
    }
    if (c.maxScreenshots) maxScreenshotsInput.value = c.maxScreenshots;
    if (c.outputDir) outputDirInput.value = c.outputDir;
    if (c.loginEmail) loginEmail.value = c.loginEmail;
    if (c.loginPassword) loginPassword.value = c.loginPassword;
    if (c.autoLogin) {
      autoLoginEnabled.checked = true;
      loginFields.style.display = 'block';
      autoLoginToggleText.textContent = t('toggle.on');
    }
    // autoOcr: explizit false beachten, sonst HTML-Default (checked)
    if (c.autoOcr === false) {
      autoOcrEnabled.checked = false;
      autoOcrToggleText.textContent = t('toggle.off');
    }
    // autoValidation: explizit false beachten, sonst HTML-Default (checked)
    if (c.autoValidation === false) {
      autoValidationEnabled.checked = false;
      autoValidationToggleText.textContent = t('toggle.off');
    }
    // autoSave: explizit false beachten, sonst HTML-Default (checked)
    if (c.autoSave === false) {
      autoSaveEnabled.checked = false;
      autoSaveToggleText.textContent = t('toggle.off');
    }
    if (c.ocrFolder) ocrFolderInput.value = c.ocrFolder;

    // OCR-Einstellungen wiederherstellen
    if (c.ocrSettings) {
      const s = c.ocrSettings;
      if (s.scale != null) { ocrScaleSlider.value = s.scale; ocrScaleValue.textContent = s.scale + 'x'; }
      if (s.greyscale != null) { ocrGreyscaleCheckbox.checked = s.greyscale; ocrGreyscaleText.textContent = s.greyscale ? t('toggle.on') : t('toggle.off'); }
      if (s.sharpen != null) { ocrSharpenSlider.value = s.sharpen; ocrSharpenValue.textContent = s.sharpen; }
      if (s.contrast != null) { ocrContrastSlider.value = s.contrast; ocrContrastValue.textContent = s.contrast; }
      if (s.threshold != null) {
        if (s.threshold > 0) {
          ocrThresholdEnabled.checked = true;
          ocrThresholdText.textContent = t('toggle.on');
          ocrThresholdValSlider.disabled = false;
          ocrThresholdValSlider.value = s.threshold;
          ocrThresholdDisplay.textContent = s.threshold;
        } else {
          ocrThresholdEnabled.checked = false;
          ocrThresholdText.textContent = t('toggle.off');
          ocrThresholdValSlider.disabled = true;
        }
      }
      if (s.psm != null) ocrPsmSelect.value = s.psm;
      if (s.lang) ocrLangSelect.value = s.lang;
      if (s.minScore != null) ocrMinScoreInput.value = s.minScore;
    }
  }

  // Initiale Uebersetzungen anwenden (nach Config-Load fuer korrekte Sprache)
  window.i18n.applyTranslations();
})();

// ─── Language Selector ──────────────────────────────────────────────────────

appLanguageSelect.addEventListener('change', () => {
  const lang = appLanguageSelect.value;
  window.i18n.setLanguage(lang);
  refreshDynamicUI();
  saveCurrentConfig();
});

/**
 * Aktualisiert alle dynamisch generierten UI-Elemente nach Sprachwechsel.
 */
function refreshDynamicUI() {
  // Toggle-Texte aktualisieren
  autoLoginToggleText.textContent = autoLoginEnabled.checked ? t('toggle.on') : t('toggle.off');
  autoOcrToggleText.textContent = autoOcrEnabled.checked ? t('toggle.on') : t('toggle.off');
  autoValidationToggleText.textContent = autoValidationEnabled.checked ? t('toggle.on') : t('toggle.off');
  autoSaveToggleText.textContent = autoSaveEnabled.checked ? t('toggle.on') : t('toggle.off');
  ocrGreyscaleText.textContent = ocrGreyscaleCheckbox.checked ? t('toggle.on') : t('toggle.off');
  ocrThresholdText.textContent = ocrThresholdEnabled.checked ? t('toggle.on') : t('toggle.off');

  // Passwort-Toggle
  const isPassword = loginPassword.type === 'password';
  btnTogglePassword.textContent = isPassword ? t('btn.showPassword') : t('btn.hidePassword');

  // Browser-Status (nur wenn es ein bekannter Status ist)
  if (!browserReady && browserStatus.textContent) {
    // Nur den Standard-Status uebersetzen
    if (!browserStatus.classList.contains('working') && !browserStatus.classList.contains('ready') && !browserStatus.classList.contains('error')) {
      browserStatus.textContent = t('status.notStarted');
    }
  }

  // Region Info aktualisieren wenn keine Region gesetzt
  if (!currentRegion) {
    regionInfo.textContent = t('status.noRegion');
  }

  // OCR-Ergebnisse und Validierung neu rendern
  if (ocrMembers) {
    renderOcrResults(ocrMembers);
  }
  if (validatedMembers) {
    renderValidationOcrTable();
    updateValidationSummary();
    showOcrValidationBanner();
  }
  renderValidationNames();
  renderCorrections();

  // History neu rendern
  if (historyEntries.length > 0) {
    renderHistoryList();
  }
  if (historyMembers && selectedHistoryFile) {
    renderHistoryDetail(historyMembers, selectedHistoryFile);
  }
}

// ─── Login Toggle ───────────────────────────────────────────────────────────

autoLoginEnabled.addEventListener('change', () => {
  const on = autoLoginEnabled.checked;
  loginFields.style.display = on ? 'block' : 'none';
  autoLoginToggleText.textContent = on ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

btnTogglePassword.addEventListener('click', () => {
  const isPassword = loginPassword.type === 'password';
  loginPassword.type = isPassword ? 'text' : 'password';
  btnTogglePassword.textContent = isPassword ? t('btn.hidePassword') : t('btn.showPassword');
});

loginEmail.addEventListener('change', saveCurrentConfig);
loginPassword.addEventListener('change', saveCurrentConfig);

// ─── Slider Updates ─────────────────────────────────────────────────────────

scrollTicksSlider.addEventListener('input', () => {
  scrollTicksValue.textContent = scrollTicksSlider.value;
});
scrollTicksSlider.addEventListener('change', saveCurrentConfig);

scrollDelaySlider.addEventListener('input', () => {
  scrollDelayValue.textContent = scrollDelaySlider.value;
});
scrollDelaySlider.addEventListener('change', saveCurrentConfig);

maxScreenshotsInput.addEventListener('change', saveCurrentConfig);
outputDirInput.addEventListener('change', saveCurrentConfig);

btnBrowseDir.addEventListener('click', async () => {
  const result = await window.api.browseFolder();
  if (result.ok) {
    outputDirInput.value = result.path;
    saveCurrentConfig();
  }
});

btnOpenOutputDir.addEventListener('click', () => {
  window.api.openFolder(outputDirInput.value);
});

// ─── Browser ────────────────────────────────────────────────────────────────

btnLaunch.addEventListener('click', async () => {
  btnLaunch.disabled = true;
  browserStatus.textContent = t('status.startingBrowser');
  browserStatus.className = 'status-bar working';

  const result = await window.api.launchBrowser(urlInput.value);
  if (!result.ok) {
    browserStatus.textContent = t('status.error', { error: result.error });
    browserStatus.className = 'status-bar error';
    btnLaunch.disabled = false;
  }
});

btnClose.addEventListener('click', async () => {
  await window.api.closeBrowser();
});

window.api.onBrowserStatus((data) => {
  switch (data.status) {
    case 'launching':
      browserStatus.textContent = t('status.browserStarting');
      browserStatus.className = 'status-bar working';
      break;
    case 'navigating':
      browserStatus.textContent = t('status.navigating');
      browserStatus.className = 'status-bar working';
      break;
    case 'ready':
      browserStatus.textContent = t('status.ready', { title: data.title || t('status.pageLoading') });
      browserStatus.className = 'status-bar ready';
      browserReady = true;
      btnLaunch.disabled = true;
      btnClose.disabled = false;
      btnSelectRegion.disabled = false;
      updateCaptureButtons();
      // Auto-Login ausfuehren falls aktiviert (nur einmal pro Sitzung)
      if (!autoLoginAttempted && autoLoginEnabled.checked && loginEmail.value && loginPassword.value) {
        autoLoginAttempted = true;
        performAutoLogin();
      }
      // Gespeicherte Region: frischen Preview holen
      if (currentRegion) {
        loadSavedRegionPreview();
      }
      break;
    case 'closed':
      browserStatus.textContent = t('status.browserClosed');
      browserStatus.className = 'status-bar';
      browserReady = false;
      autoLoginAttempted = false;
      btnLaunch.disabled = false;
      btnClose.disabled = true;
      btnSelectRegion.disabled = true;
      btnTestScroll.disabled = true;
      btnStartCapture.disabled = true;
      break;
    case 'error':
      browserStatus.textContent = t('status.error', { error: data.error });
      browserStatus.className = 'status-bar error';
      btnLaunch.disabled = false;
      break;
  }
});

// ─── Region ─────────────────────────────────────────────────────────────────

btnSelectRegion.addEventListener('click', async () => {
  btnSelectRegion.disabled = true;
  regionInfo.textContent = t('status.selectInBrowser');

  const result = await window.api.selectRegion();
  btnSelectRegion.disabled = false;

  if (result.ok) {
    currentRegion = result.region;
    const r = result.region;
    regionInfo.textContent = `${r.width} x ${r.height} @ (${r.x}, ${r.y})`;

    if (result.preview) {
      regionPreview.src = `data:image/png;base64,${result.preview}`;
      regionPreviewContainer.style.display = 'block';
    }

    updateCaptureButtons();
    saveCurrentConfig();
  } else {
    regionInfo.textContent = t('status.error', { error: result.error });
  }
});

// ─── Kalibrierung ───────────────────────────────────────────────────────────

btnTestScroll.addEventListener('click', async () => {
  if (!currentRegion) return;

  btnTestScroll.disabled = true;
  testInfo.textContent = t('status.scrolling');

  const result = await window.api.testScroll({
    region: currentRegion,
    scrollTicks: parseInt(scrollTicksSlider.value),
    scrollDelay: parseInt(scrollDelaySlider.value),
  });

  btnTestScroll.disabled = false;

  if (result.ok) {
    const diff = ((1 - result.similarity) * 100).toFixed(1);
    testInfo.textContent = t('status.difference', { pct: diff });

    testBefore.src = `data:image/png;base64,${result.before}`;
    testAfter.src = `data:image/png;base64,${result.after}`;
    testPreviewContainer.style.display = 'flex';
  } else {
    testInfo.textContent = t('status.error', { error: result.error });
  }
});

// ─── Capture ────────────────────────────────────────────────────────────────

btnStartCapture.addEventListener('click', async () => {
  if (!currentRegion || !browserReady) return;

  capturing = true;
  btnStartCapture.disabled = true;
  btnStopCapture.disabled = false;
  progressContainer.style.display = 'flex';
  progressFill.style.width = '0%';
  progressText.textContent = '0 / ' + maxScreenshotsInput.value;
  gallery.innerHTML = '';
  gallerySection.style.display = 'block';
  captureResult.textContent = '';

  // Zum Capture-Tab wechseln und zur Galerie scrollen
  switchToTab('capture');
  setTimeout(() => gallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  saveCurrentConfig();

  await window.api.startCapture({
    region: currentRegion,
    scrollTicks: parseInt(scrollTicksSlider.value),
    scrollDelay: parseInt(scrollDelaySlider.value),
    maxScreenshots: parseInt(maxScreenshotsInput.value),
    outputDir: outputDirInput.value,
  });
});

btnStopCapture.addEventListener('click', async () => {
  await window.api.stopCapture();
  btnStopCapture.disabled = true;
});

window.api.onCaptureProgress((data) => {
  const max = data.max || parseInt(maxScreenshotsInput.value);
  const pct = Math.round((data.count / max) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = `${data.count} / ${max}`;

  if (data.thumbnail && data.status === 'capturing') {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="data:image/png;base64,${data.thumbnail}" alt="${data.filename}">
      <span class="gallery-label">${data.filename}</span>
    `;
    item.addEventListener('click', () => {
      showLightbox(`data:image/png;base64,${data.thumbnail}`);
    });
    gallery.appendChild(item);
    gallery.scrollTop = gallery.scrollHeight;
  }

  if (data.status === 'end-detected') {
    // Duplikate aus der Galerie entfernen (letzte Eintraege die ueber data.count hinausgehen)
    while (gallery.children.length > data.count) {
      gallery.removeChild(gallery.lastChild);
    }
    progressText.textContent = `${data.count} / ${max}`;
    captureResult.textContent = t('status.listEndDetected', { count: data.count });
  }
});

window.api.onCaptureDone((data) => {
  capturing = false;
  btnStartCapture.disabled = false;
  btnStopCapture.disabled = true;
  lastOutputDir = data.outputDir;

  captureResult.textContent = t('status.captureComplete', { count: data.count, dir: data.outputDir });
  progressFill.style.width = '100%';

  // OCR-Ordner automatisch setzen
  ocrFolderInput.value = data.outputDir;

  // Auto-OCR starten falls aktiviert
  if (autoOcrEnabled.checked && data.count > 0) {
    startOcr(data.outputDir);
  }
});

btnOpenFolder.addEventListener('click', () => {
  if (lastOutputDir) {
    window.api.openFolder(lastOutputDir);
  }
});

// ─── Log ────────────────────────────────────────────────────────────────────

window.api.onLog((data) => {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${data.level}`;
  const time = new Date().toLocaleTimeString('de-DE');
  entry.textContent = `[${time}] ${data.message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;

  while (logContainer.children.length > 200) {
    logContainer.removeChild(logContainer.firstChild);
  }
});

// ─── Lightbox ───────────────────────────────────────────────────────────────

function showLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

// ─── OCR Auswertung ─────────────────────────────────────────────────────────

autoOcrEnabled.addEventListener('change', () => {
  autoOcrToggleText.textContent = autoOcrEnabled.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

autoValidationEnabled.addEventListener('change', () => {
  autoValidationToggleText.textContent = autoValidationEnabled.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

autoSaveEnabled.addEventListener('change', () => {
  autoSaveToggleText.textContent = autoSaveEnabled.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

// OCR Einstellungen Event-Listener
ocrScaleSlider.addEventListener('input', () => {
  ocrScaleValue.textContent = ocrScaleSlider.value + 'x';
});
ocrScaleSlider.addEventListener('change', saveCurrentConfig);

ocrGreyscaleCheckbox.addEventListener('change', () => {
  ocrGreyscaleText.textContent = ocrGreyscaleCheckbox.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

ocrSharpenSlider.addEventListener('input', () => {
  ocrSharpenValue.textContent = ocrSharpenSlider.value;
});
ocrSharpenSlider.addEventListener('change', saveCurrentConfig);

ocrContrastSlider.addEventListener('input', () => {
  ocrContrastValue.textContent = ocrContrastSlider.value;
});
ocrContrastSlider.addEventListener('change', saveCurrentConfig);

ocrThresholdEnabled.addEventListener('change', () => {
  const on = ocrThresholdEnabled.checked;
  ocrThresholdText.textContent = on ? t('toggle.on') : t('toggle.off');
  ocrThresholdValSlider.disabled = !on;
  saveCurrentConfig();
});
ocrThresholdValSlider.addEventListener('input', () => {
  ocrThresholdDisplay.textContent = ocrThresholdValSlider.value;
});
ocrThresholdValSlider.addEventListener('change', saveCurrentConfig);

ocrPsmSelect.addEventListener('change', saveCurrentConfig);
ocrLangSelect.addEventListener('change', saveCurrentConfig);
ocrMinScoreInput.addEventListener('change', saveCurrentConfig);

btnGoToValidation.addEventListener('click', () => {
  switchToTab('validation');
});

btnBrowseOcrFolder.addEventListener('click', async () => {
  const defaultPath = lastOutputDir || outputDirInput.value || './captures';
  const result = await window.api.browseFolder({
    title: 'Capture-Ordner fuer OCR waehlen',
    defaultPath,
  });
  if (result.ok) {
    ocrFolderInput.value = result.path;
    saveCurrentConfig();
  }
});

btnStartOcr.addEventListener('click', () => startOcr());

btnStopOcr.addEventListener('click', async () => {
  await window.api.stopOcr();
  btnStopOcr.disabled = true;
});

btnExportCsv.addEventListener('click', async () => {
  if (!ocrMembers || ocrMembers.length === 0) return;

  const defaultName = `mitglieder_${localDateString()}.csv`;
  const result = await window.api.exportCsv(ocrMembers, defaultName);
  if (result.ok) {
    ocrStatus.textContent = t('status.csvSaved', { path: result.path });
  }
});

function getOcrSettings() {
  return {
    scale: parseFloat(ocrScaleSlider.value),
    greyscale: ocrGreyscaleCheckbox.checked,
    sharpen: parseFloat(ocrSharpenSlider.value),
    contrast: parseFloat(ocrContrastSlider.value),
    threshold: ocrThresholdEnabled.checked ? parseInt(ocrThresholdValSlider.value) : 0,
    psm: parseInt(ocrPsmSelect.value),
    lang: ocrLangSelect.value,
    minScore: parseInt(ocrMinScoreInput.value) || 10000,
  };
}

async function startOcr(folderPath) {
  const folder = folderPath || ocrFolderInput.value;
  if (!folder) {
    ocrStatus.textContent = t('status.noFolder');
    return;
  }

  ocrRunning = true;
  ocrMembers = null;
  btnStartOcr.disabled = true;
  btnStopOcr.disabled = false;
  ocrStatus.textContent = t('status.initOcr');
  ocrProgressContainer.style.display = 'flex';
  ocrProgressFill.style.width = '0%';
  ocrProgressText.textContent = '0 / ?';
  ocrResultContainer.style.display = 'none';
  ocrTableBody.innerHTML = '';

  // Zum Capture-Tab wechseln und zur Auswertung scrollen
  switchToTab('capture');
  setTimeout(() => auswertungSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  const result = await window.api.startOcr(folder, getOcrSettings());

  ocrRunning = false;
  btnStartOcr.disabled = false;
  btnStopOcr.disabled = true;

  if (result.ok) {
    ocrStatus.textContent = t('status.membersDetected', { count: result.members.length });
    ocrProgressFill.style.width = '100%';
  } else {
    ocrStatus.textContent = t('status.error', { error: result.error });
  }
}

window.api.onOcrProgress((data) => {
  const pct = Math.round((data.current / data.total) * 100);
  ocrProgressFill.style.width = pct + '%';
  ocrProgressText.textContent = `${data.current} / ${data.total}`;
  ocrStatus.textContent = t('status.processing', { file: data.file });
});

window.api.onOcrDone(async (data) => {
  ocrMembers = data.members;
  renderOcrResults(data.members);

  // Auto-Validierung
  if (autoValidationEnabled.checked && validationKnownNames.length > 0) {
    await validateCurrentResults();
    showOcrValidationBanner();

    // Auto-Save: CSV nur speichern wenn Validierung fehlerfrei
    if (autoSaveEnabled.checked && validatedMembers) {
      const hasErrors = validatedMembers.some(m =>
        m.validationStatus === 'unknown' || m.validationStatus === 'suggested'
      );
      if (!hasErrors) {
        await autoSaveCsv();
      }
    }
  }
});

function renderOcrResults(members) {
  ocrResultContainer.style.display = 'block';
  ocrResultCount.textContent = t('result.membersFound', { count: members.length });
  ocrTableBody.innerHTML = '';

  members.forEach((m, idx) => {
    const tr = document.createElement('tr');
    const rankClass = getRankClass(m.rank);
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="ocr-rank-badge ${rankClass}">${m.rank}</span></td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.coords)}</td>
      <td>${m.score.toLocaleString('de-DE')}</td>
    `;
    ocrTableBody.appendChild(tr);
  });
}

function getRankClass(rank) {
  const r = rank.toLowerCase();
  if (r.includes('anfüh') || r.includes('anfuh')) return 'rank-anfuehrer';
  if (r.includes('vorge')) return 'rank-vorgesetzter';
  if (r.includes('offiz')) return 'rank-offizier';
  if (r.includes('mitgl')) return 'rank-mitglied';
  if (r.includes('rekru')) return 'rank-rekrut';
  if (r.includes('veter')) return 'rank-veteran';
  return 'rank-default';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateCaptureButtons() {
  const ready = browserReady && currentRegion;
  btnTestScroll.disabled = !ready;
  btnStartCapture.disabled = !ready || capturing;
}

async function performAutoLogin() {
  browserStatus.textContent = t('status.autoLogin');
  browserStatus.className = 'status-bar working';

  const result = await window.api.autoLogin({
    email: loginEmail.value,
    password: loginPassword.value,
  });

  if (result.ok) {
    browserStatus.textContent = t('status.loggedIn');
    browserStatus.className = 'status-bar ready';
  } else {
    browserStatus.textContent = t('status.loginFailed', { error: result.error });
    browserStatus.className = 'status-bar error';
    browserReady = true;
    btnSelectRegion.disabled = false;
    updateCaptureButtons();
  }
}

async function loadSavedRegionPreview() {
  if (!currentRegion || !browserReady) return;
  const r = currentRegion;
  regionInfo.textContent = t('status.loadingPreview', { w: r.width, h: r.height, x: r.x, y: r.y });

  const result = await window.api.previewRegion(currentRegion);
  if (result.ok) {
    regionPreview.src = `data:image/png;base64,${result.preview}`;
    regionPreviewContainer.style.display = 'block';
    regionInfo.textContent = t('status.regionSaved', { w: r.width, h: r.height, x: r.x, y: r.y });
  } else {
    regionInfo.textContent = t('status.previewFailed', { w: r.width, h: r.height, x: r.x, y: r.y });
  }
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === `tab-${target}`);
    });

    // Beim Wechsel zum Validierung-Tab: automatisch validieren falls OCR-Ergebnisse vorhanden
    if (target === 'validation' && ocrMembers && ocrMembers.length > 0 && !validatedMembers) {
      validateCurrentResults();
    }
    // Beim Wechsel zum History-Tab: History laden
    if (target === 'history') {
      loadHistory();
    }
  });
});

/** Programmtisch zum Capture-Tab wechseln */
function switchToTab(tabName) {
  tabBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  tabContents.forEach(tc => {
    tc.classList.toggle('active', tc.id === `tab-${tabName}`);
  });
}

// ─── Log leeren ──────────────────────────────────────────────────────────────

btnClearLog.addEventListener('click', () => {
  logContainer.innerHTML = '';
});

// ─── Letzten Capture-Ordner loeschen ─────────────────────────────────────────

btnDeleteCapture.addEventListener('click', async () => {
  if (!lastOutputDir) return;

  const ok = confirm(t('confirm.deleteCapture', { path: lastOutputDir }));
  if (!ok) return;

  const result = await window.api.deleteFolder(lastOutputDir);
  if (result.ok) {
    gallerySection.style.display = 'none';
    gallery.innerHTML = '';
    captureResult.textContent = '';
    lastOutputDir = null;
    ocrFolderInput.value = '';
    ocrResultContainer.style.display = 'none';
    ocrTableBody.innerHTML = '';
    ocrMembers = null;
  }
});

// ─── Validierung ─────────────────────────────────────────────────────────────

async function loadValidationList() {
  const result = await window.api.loadValidationList();
  if (result.ok) {
    validationKnownNames = result.knownNames || [];
    validationCorrections = result.corrections || {};
    renderValidationNames();
    renderCorrections();
    // Wenn OCR-Ergebnisse vorhanden und noch nicht validiert, automatisch validieren
    if (ocrMembers && ocrMembers.length > 0 && validationKnownNames.length > 0 && !validatedMembers) {
      await validateCurrentResults();
    }
  }
}

function showOcrValidationBanner() {
  if (!validatedMembers || !autoValidationEnabled.checked) {
    ocrValidationBanner.style.display = 'none';
    return;
  }

  const counts = { confirmed: 0, corrected: 0, suggested: 0, unknown: 0 };
  validatedMembers.forEach(m => counts[m.validationStatus]++);
  const total = validatedMembers.length;
  const ok = counts.confirmed + counts.corrected;
  const errors = counts.suggested + counts.unknown;

  ocrValidationBanner.style.display = 'flex';

  if (errors === 0) {
    ocrValidationBanner.className = 'ocr-validation-banner banner-success';
    ocrValidationIcon.textContent = '\u2714';
    ocrValidationMsg.textContent = t('validation.bannerSuccess', { total });
    btnGoToValidation.style.display = 'none';

    // Status-Zeile aktualisieren
    ocrStatus.textContent = t('status.allValidated', { total });
  } else if (counts.unknown > 0) {
    ocrValidationBanner.className = 'ocr-validation-banner banner-error';
    ocrValidationIcon.textContent = '\u2716';
    ocrValidationMsg.textContent = t('validation.bannerError', {
      errors, unknown: counts.unknown, suggested: counts.suggested, ok, total,
    });
    btnGoToValidation.style.display = '';

    ocrStatus.textContent = t('status.validationErrors', { total, errors });
  } else {
    ocrValidationBanner.className = 'ocr-validation-banner banner-warning';
    ocrValidationIcon.textContent = '\u26A0';
    ocrValidationMsg.textContent = t('validation.bannerWarning', {
      suggested: counts.suggested, ok, total,
    });
    btnGoToValidation.style.display = '';

    ocrStatus.textContent = t('status.validationSuggestions', { total, suggested: counts.suggested });
  }
}

async function autoSaveCsv() {
  if (!ocrMembers || ocrMembers.length === 0) return;

  // Korrigierte Namen aus der Validierung verwenden
  const membersToSave = validatedMembers
    ? validatedMembers.map(m => ({
        rank: m.rank,
        name: m.name,
        coords: m.coords,
        score: m.score,
      }))
    : ocrMembers;

  const result = await window.api.autoSaveCsv(membersToSave);
  if (result.ok) {
    ocrStatus.textContent += ` ${t('status.csvAutoSaved', { fileName: result.fileName })}`;
  }
}

async function validateCurrentResults() {
  if (!ocrMembers || ocrMembers.length === 0) {
    validationEmptyHint.style.display = 'block';
    validationContent.style.display = 'none';
    validationSummary.textContent = '';
    return;
  }

  const result = await window.api.validateOcrResults(ocrMembers);
  if (result.ok) {
    validatedMembers = result.members;
    validationEmptyHint.style.display = 'none';
    validationContent.style.display = 'grid';
    renderValidationOcrTable();
    updateValidationSummary();
    // Liste nach Validierung neu laden (evtl. neue Korrekturen)
    await loadValidationList();
  }
}

function updateValidationSummary() {
  if (!validatedMembers) return;
  const counts = { confirmed: 0, corrected: 0, suggested: 0, unknown: 0 };
  validatedMembers.forEach(m => counts[m.validationStatus]++);
  const total = validatedMembers.length;
  const ok = counts.confirmed + counts.corrected;
  validationSummary.textContent = t('validation.summary', {
    ok, total, suggested: counts.suggested, unknown: counts.unknown,
  });
}

function renderValidationOcrTable() {
  validationOcrBody.innerHTML = '';
  if (!validatedMembers) return;

  const statusLabels = {
    confirmed: t('validation.confirmed'),
    corrected: t('validation.corrected'),
    suggested: t('validation.suggested'),
    unknown: t('validation.unknown'),
  };

  validatedMembers.forEach((m, idx) => {
    // Filter anwenden
    if (validationFilter !== 'all' && m.validationStatus !== validationFilter) return;

    const tr = document.createElement('tr');
    tr.className = `v-row-${m.validationStatus}`;
    if (selectedOcrRow === idx) tr.classList.add('selected');

    const statusLabel = statusLabels[m.validationStatus] || m.validationStatus;

    let correctionHtml = '';
    if (m.validationStatus === 'corrected' && m.originalName !== m.name) {
      correctionHtml = `<span class="v-correction">${escapeHtml(m.name)}</span>
        <span class="v-original-name">OCR: ${escapeHtml(m.originalName)}</span>`;
    } else if (m.validationStatus === 'suggested' && m.suggestion) {
      correctionHtml = `<span class="v-suggestion">${escapeHtml(m.suggestion)}?</span>`;
    }

    let actionHtml = '';
    if (m.validationStatus === 'suggested' && m.suggestion) {
      actionHtml = `<button class="v-action-btn accept" data-idx="${idx}" data-action="accept-suggestion" title="${t('tooltip.acceptSuggestion')}">&#10003;</button>`;
    }
    if (m.validationStatus === 'unknown' || m.validationStatus === 'suggested') {
      actionHtml += ` <button class="v-action-btn" data-idx="${idx}" data-action="select-for-assign" title="${t('tooltip.startAssignment')}">&#9998;</button>`;
    }

    tr.innerHTML = `
      <td><span class="v-status v-status-${m.validationStatus}"></span> ${statusLabel}</td>
      <td>${escapeHtml(m.validationStatus === 'corrected' ? m.originalName : m.name)}</td>
      <td>${correctionHtml}</td>
      <td>${actionHtml}</td>
    `;

    // Klick auf Zeile = Auswahl fuer Zuordnung
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.v-action-btn')) return; // Button-Klicks separat
      selectedOcrRow = idx;
      renderValidationOcrTable();
    });

    validationOcrBody.appendChild(tr);
  });

  // Action-Buttons verdrahten
  validationOcrBody.querySelectorAll('.v-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;

      if (action === 'accept-suggestion') {
        const member = validatedMembers[idx];
        if (member.suggestion) {
          await window.api.addCorrection(member.originalName || member.name, member.suggestion);
          // Name im OCR-Ergebnis aktualisieren
          ocrMembers[idx].name = member.suggestion;
          await validateCurrentResults();
        }
      } else if (action === 'select-for-assign') {
        selectedOcrRow = idx;
        renderValidationOcrTable();
      }
    });
  });
}

function renderValidationNames() {
  validationNamesList.innerHTML = '';
  validationNameCount.textContent = t('format.nameCount', { count: validationKnownNames.length });

  const searchTerm = validationSearch ? validationSearch.value.toLowerCase() : '';
  const filtered = searchTerm
    ? validationKnownNames.filter(n => n.toLowerCase().includes(searchTerm))
    : validationKnownNames;

  const sorted = filtered.slice().sort((a, b) => a.localeCompare(b, 'de'));

  sorted.forEach(name => {
    const item = document.createElement('div');
    item.className = 'validation-name-item';

    // Hervorheben wenn es ein selektierter OCR-Eintrag ist und dieser Name passt
    if (selectedOcrRow !== null && validatedMembers) {
      const sel = validatedMembers[selectedOcrRow];
      if (sel && sel.suggestion === name) {
        item.classList.add('highlighted');
      }
    }

    item.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button class="remove-btn" title="${t('tooltip.removeName')}">&times;</button>
    `;

    // Klick auf Name = Zuordnung zum selektierten OCR-Eintrag
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.remove-btn')) return;
      if (selectedOcrRow === null || !validatedMembers) return;

      const member = validatedMembers[selectedOcrRow];
      if (!member) return;

      const ocrName = member.originalName || member.name;
      await window.api.addCorrection(ocrName, name);
      // OCR-Ergebnis aktualisieren
      ocrMembers[selectedOcrRow].name = name;
      selectedOcrRow = null;
      await validateCurrentResults();
    });

    // Entfernen-Button
    item.querySelector('.remove-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(t('confirm.removeName', { name }))) {
        await window.api.removeValidationName(name);
        await loadValidationList();
        if (validatedMembers) await validateCurrentResults();
      }
    });

    validationNamesList.appendChild(item);
  });
}

function renderCorrections() {
  correctionsList.innerHTML = '';
  const entries = Object.entries(validationCorrections);
  correctionCount.textContent = entries.length;

  entries.forEach(([from, to]) => {
    const item = document.createElement('div');
    item.className = 'correction-item';
    item.innerHTML = `
      <span class="correction-from" title="${escapeHtml(from)}">${escapeHtml(from)}</span>
      <span class="correction-arrow">&rarr;</span>
      <span class="correction-to" title="${escapeHtml(to)}">${escapeHtml(to)}</span>
      <button class="remove-btn" title="${t('tooltip.removeCorrection')}">&times;</button>
    `;

    item.querySelector('.remove-btn').addEventListener('click', async () => {
      await window.api.removeCorrection(from);
      await loadValidationList();
      if (validatedMembers) await validateCurrentResults();
    });

    correctionsList.appendChild(item);
  });
}

// Filter-Buttons
validationFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    validationFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    validationFilter = btn.dataset.filter;
    renderValidationOcrTable();
  });
});

// Suche in Namensliste
validationSearch.addEventListener('input', () => {
  renderValidationNames();
});

// Name hinzufuegen
btnAddValidationName.addEventListener('click', async () => {
  const name = prompt(t('prompt.addName'));
  if (name && name.trim()) {
    await window.api.addValidationName(name.trim());
    await loadValidationList();
    if (validatedMembers) await validateCurrentResults();
  }
});

// Alle Vorschlaege uebernehmen
btnAcceptAllSuggestions.addEventListener('click', async () => {
  if (!validatedMembers) return;
  const suggestions = validatedMembers.filter(m => m.validationStatus === 'suggested' && m.suggestion);
  if (suggestions.length === 0) return;

  if (!confirm(t('confirm.acceptSuggestions', { count: suggestions.length }))) return;

  for (const member of suggestions) {
    const ocrName = member.originalName || member.name;
    await window.api.addCorrection(ocrName, member.suggestion);
    // Auch in ocrMembers aktualisieren
    const idx = validatedMembers.indexOf(member);
    if (idx >= 0) ocrMembers[idx].name = member.suggestion;
  }

  await validateCurrentResults();
});

// Import / Export
btnImportValidation.addEventListener('click', async () => {
  const result = await window.api.importValidationList();
  if (result.ok) {
    await loadValidationList();
    if (validatedMembers) await validateCurrentResults();
  }
});

btnExportValidation.addEventListener('click', async () => {
  await window.api.exportValidationList();
});

// Erneut validieren
btnRevalidate.addEventListener('click', async () => {
  if (ocrMembers && ocrMembers.length > 0) {
    await validateCurrentResults();
    switchToTab('validation');
  }
});

// ─── History ─────────────────────────────────────────────────────────────────

async function loadHistory() {
  const result = await window.api.loadHistory();
  if (!result.ok) return;

  historyEntries = result.entries;

  if (historyEntries.length === 0) {
    historyEmptyHint.style.display = 'block';
    historyListContainer.style.display = 'none';
    historyDetailSection.style.display = 'none';
    return;
  }

  historyEmptyHint.style.display = 'none';
  historyListContainer.style.display = 'block';
  renderHistoryList();
}

function renderHistoryList() {
  historyListBody.innerHTML = '';

  const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';

  historyEntries.forEach(entry => {
    const tr = document.createElement('tr');
    if (selectedHistoryFile === entry.fileName) tr.classList.add('active');

    const dateFormatted = new Date(entry.date + 'T00:00:00').toLocaleDateString(locale, {
      weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    });

    tr.innerHTML = `
      <td><span class="history-date">${dateFormatted}</span></td>
      <td>${t('format.memberCount', { count: entry.memberCount })}</td>
      <td class="info-text">${escapeHtml(entry.fileName)}</td>
      <td><button class="history-delete-btn" title="${t('tooltip.removeName')}">&times;</button></td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete-btn')) return;
      selectedHistoryFile = entry.fileName;
      renderHistoryList();
      loadHistoryDetail(entry.fileName);
    });

    tr.querySelector('.history-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(t('confirm.deleteHistory', { fileName: entry.fileName }))) return;
      await window.api.deleteHistoryEntry(entry.fileName);
      if (selectedHistoryFile === entry.fileName) {
        selectedHistoryFile = null;
        historyDetailSection.style.display = 'none';
        historyMembers = null;
      }
      await loadHistory();
    });

    historyListBody.appendChild(tr);
  });
}

async function loadHistoryDetail(fileName) {
  const result = await window.api.loadHistoryEntry(fileName);
  if (!result.ok) return;

  historyMembers = result.members;
  renderHistoryDetail(result.members, fileName);
}

function renderHistoryDetail(members, fileName) {
  historyDetailSection.style.display = 'block';

  const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';

  // Datum aus Dateiname extrahieren
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch
    ? new Date(dateMatch[1] + 'T00:00:00').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    : fileName;
  historyDetailTitle.textContent = t('history.resultTitle', { date: dateStr });
  historyDetailCount.textContent = t('format.memberCount', { count: members.length });

  historyDetailBody.innerHTML = '';
  members.forEach((m, idx) => {
    const tr = document.createElement('tr');
    const rankClass = getRankClass(m.rank);
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="ocr-rank-badge ${rankClass}">${escapeHtml(m.rank)}</span></td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.coords)}</td>
      <td>${m.score.toLocaleString('de-DE')}</td>
    `;
    historyDetailBody.appendChild(tr);
  });

  // Zum Detail scrollen
  setTimeout(() => historyDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

btnRefreshHistory.addEventListener('click', () => loadHistory());

btnOpenResultsDir.addEventListener('click', () => {
  window.api.openFolder('./results');
});

btnHistoryExportCsv.addEventListener('click', async () => {
  if (!historyMembers || historyMembers.length === 0) return;
  const defaultName = selectedHistoryFile || `mitglieder_${localDateString()}.csv`;
  await window.api.exportCsv(historyMembers, defaultName);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Gibt das heutige Datum als YYYY-MM-DD in lokaler Zeitzone zurueck. */
function localDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function saveCurrentConfig() {
  await window.api.saveConfig({
    language: window.i18n.getLanguage(),
    region: currentRegion,
    scrollTicks: parseInt(scrollTicksSlider.value),
    scrollDelay: parseInt(scrollDelaySlider.value),
    maxScreenshots: parseInt(maxScreenshotsInput.value),
    outputDir: outputDirInput.value,
    autoLogin: autoLoginEnabled.checked,
    loginEmail: loginEmail.value,
    loginPassword: loginPassword.value,
    autoOcr: autoOcrEnabled.checked,
    autoValidation: autoValidationEnabled.checked,
    autoSave: autoSaveEnabled.checked,
    ocrFolder: ocrFolderInput.value,
    ocrSettings: getOcrSettings(),
  });
}
