// ─── i18n Shortcut ──────────────────────────────────────────────────────────

const t = (key, vars) => window.i18n.t(key, vars);

// ─── DOM Elemente ───────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Input-Dialog (Ersatz fuer prompt()) ─────────────────────────────────────

/**
 * Zeigt einen modalen Input-Dialog (funktioniert zuverlaessig in Electron).
 * @param {string} title - Dialog-Titel/Frage
 * @param {string} [defaultValue=''] - Vorausgefuellter Wert
 * @returns {Promise<string|null>} Eingegebener Wert oder null bei Abbruch
 */
function showInputDialog(title, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = $('#inputDialog');
    const titleEl = $('#inputDialogTitle');
    const input = $('#inputDialogInput');
    const btnOk = $('#inputDialogOk');
    const btnCancel = $('#inputDialogCancel');

    titleEl.textContent = title;
    input.value = defaultValue;
    overlay.style.display = 'flex';

    // Focus und Text auswaehlen
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    function cleanup() {
      overlay.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onOverlayClick);
    }

    function onOk() {
      cleanup();
      resolve(input.value);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }

    function onOverlayClick(e) {
      if (e.target === overlay) onCancel();
    }

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onOverlayClick);
  });
}

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
const btnCopyLog = $('#btnCopyLog');
const btnOpenLogFolder = $('#btnOpenLogFolder');

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
const btnOpenOcrFolder = $('#btnOpenOcrFolder');
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
const validationOcrContent = $('#validationOcrContent');
const validationOcrBody = $('#validationOcrBody');
const validationSearch = $('#validationSearch');
const validationNamesList = $('#validationNamesList');
const validationNameCount = $('#validationNameCount');
const correctionsList = $('#correctionsList');
const correctionCount = $('#correctionCount');
const correctionFromInput = $('#correctionFromInput');
const correctionToInput = $('#correctionToInput');
const btnAddManualCorrection = $('#btnAddManualCorrection');
const correctionSearch = $('#correctionSearch');
const btnAcceptAllSuggestions = $('#btnAcceptAllSuggestions');
const btnAddSelectedToList = $('#btnAddSelectedToList');
const validationSelectAll = $('#validationSelectAll');
const validationOcrHead = $('#validationOcrHead');
const validationModeSubTabBar = $('#validationModeSubTabBar');
const btnAddValidationName = $('#btnAddValidationName');
const btnValidationExportCsv = $('#btnValidationExportCsv');
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

// Event DOM Elements
const btnSelectEventRegion = $('#btnSelectEventRegion');
const eventRegionInfo = $('#eventRegionInfo');
const eventRegionPreviewContainer = $('#eventRegionPreviewContainer');
const eventRegionPreview = $('#eventRegionPreview');

const eventScrollTicksSlider = $('#eventScrollTicks');
const eventScrollTicksValue = $('#eventScrollTicksValue');
const eventScrollDelaySlider = $('#eventScrollDelay');
const eventScrollDelayValue = $('#eventScrollDelayValue');
const btnTestEventScroll = $('#btnTestEventScroll');
const eventTestInfo = $('#eventTestInfo');
const eventTestPreviewContainer = $('#eventTestPreviewContainer');
const eventTestBefore = $('#eventTestBefore');
const eventTestAfter = $('#eventTestAfter');

const eventMaxScreenshotsInput = $('#eventMaxScreenshots');
const eventOutputDirInput = $('#eventOutputDir');
const btnBrowseEventDir = $('#btnBrowseEventDir');
const btnOpenEventOutputDir = $('#btnOpenEventOutputDir');
const btnStartEventCapture = $('#btnStartEventCapture');
const btnStopEventCapture = $('#btnStopEventCapture');
const eventProgressContainer = $('#eventProgressContainer');
const eventProgressFill = $('#eventProgressFill');
const eventProgressText = $('#eventProgressText');

const eventGallerySection = $('#eventGallerySection');
const eventGallery = $('#eventGallery');
const btnOpenEventFolder = $('#btnOpenEventFolder');
const btnDeleteEventCapture = $('#btnDeleteEventCapture');
const eventCaptureResult = $('#eventCaptureResult');

const eventAutoOcrEnabled = $('#eventAutoOcrEnabled');
const eventAutoOcrToggleText = $('#eventAutoOcrToggleText');
const eventAutoValidationEnabled = $('#eventAutoValidationEnabled');
const eventAutoValidationToggleText = $('#eventAutoValidationToggleText');
const eventAutoSaveEnabled = $('#eventAutoSaveEnabled');
const eventAutoSaveToggleText = $('#eventAutoSaveToggleText');

const eventOcrFolderInput = $('#eventOcrFolder');
const btnBrowseEventOcrFolder = $('#btnBrowseEventOcrFolder');
const btnOpenEventOcrFolder = $('#btnOpenEventOcrFolder');
const btnStartEventOcr = $('#btnStartEventOcr');
const btnStopEventOcr = $('#btnStopEventOcr');
const eventOcrStatus = $('#eventOcrStatus');
const eventOcrProgressContainer = $('#eventOcrProgressContainer');
const eventOcrProgressFill = $('#eventOcrProgressFill');
const eventOcrProgressText = $('#eventOcrProgressText');
const eventOcrResultContainer = $('#eventOcrResultContainer');
const eventOcrResultCount = $('#eventOcrResultCount');
const eventOcrTableBody = $('#eventOcrTableBody');
const btnExportEventCsv = $('#btnExportEventCsv');
const eventAuswertungSection = $('#eventAuswertungSection');
const eventOcrValidationBanner = $('#eventOcrValidationBanner');
const eventOcrValidationIcon = $('#eventOcrValidationIcon');
const eventOcrValidationMsg = $('#eventOcrValidationMsg');
const btnGoToEventValidation = $('#btnGoToEventValidation');

const eventOcrScaleSlider = $('#eventOcrScale');
const eventOcrScaleValue = $('#eventOcrScaleValue');
const eventOcrGreyscaleCheckbox = $('#eventOcrGreyscale');
const eventOcrGreyscaleText = $('#eventOcrGreyscaleText');
const eventOcrSharpenSlider = $('#eventOcrSharpen');
const eventOcrSharpenValue = $('#eventOcrSharpenValue');
const eventOcrContrastSlider = $('#eventOcrContrast');
const eventOcrContrastValue = $('#eventOcrContrastValue');
const eventOcrThresholdEnabled = $('#eventOcrThresholdEnabled');
const eventOcrThresholdText = $('#eventOcrThresholdText');
const eventOcrThresholdValSlider = $('#eventOcrThresholdVal');
const eventOcrThresholdDisplay = $('#eventOcrThresholdDisplay');
const eventOcrPsmSelect = $('#eventOcrPsm');
const eventOcrLangSelect = $('#eventOcrLang');
const eventOcrMinScoreInput = $('#eventOcrMinScore');

// History Event Table
const historyEventTable = $('#historyEventTable');
const historyEventDetailBody = $('#historyEventDetailBody');
const historyMemberTable = $('#historyMemberTable');

// Tab Navigation
const tabBtns = $$('.tab-btn');
const tabContents = $$('.tab-content');

// Sub-Tab Navigation
const subTabBtns = $$('.sub-tab-btn');

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
let selectedOcrRows = new Set();  // Ausgewaehlte OCR-Zeilen fuer Batch-Operationen
let validationFilter = 'all';
let activeCorrections = new Set();  // OCR-Namen die in aktuellen Ergebnissen korrigiert wurden
let historyEntries = [];
let selectedHistoryFile = null;
let historyMembers = null;

// Event-spezifischer State
let eventRegion = null;
let eventCapturing = false;
let eventLastOutputDir = null;
let eventOcrRunning = false;
let eventOcrEntries = null;  // letzte Event-OCR-Ergebnisse [{ name, power, eventPoints }]
let validationMode = 'member';  // 'member' oder 'event' — bestimmt den aktuellen Validierungsmodus

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

    // ─── Event-Einstellungen wiederherstellen ─────────────────────
    if (c.eventRegion) {
      eventRegion = c.eventRegion;
      eventRegionInfo.textContent = `${c.eventRegion.width} x ${c.eventRegion.height} @ (${c.eventRegion.x}, ${c.eventRegion.y})`;
    }
    if (c.eventScrollTicks) {
      eventScrollTicksSlider.value = c.eventScrollTicks;
      eventScrollTicksValue.textContent = c.eventScrollTicks;
    }
    if (c.eventScrollDelay) {
      eventScrollDelaySlider.value = c.eventScrollDelay;
      eventScrollDelayValue.textContent = c.eventScrollDelay;
    }
    if (c.eventMaxScreenshots) eventMaxScreenshotsInput.value = c.eventMaxScreenshots;
    if (c.eventOutputDir) eventOutputDirInput.value = c.eventOutputDir;
    if (c.eventOcrFolder) eventOcrFolderInput.value = c.eventOcrFolder;
    if (c.eventAutoOcr === false) {
      eventAutoOcrEnabled.checked = false;
      eventAutoOcrToggleText.textContent = t('toggle.off');
    }
    if (c.eventAutoValidation === false) {
      eventAutoValidationEnabled.checked = false;
      eventAutoValidationToggleText.textContent = t('toggle.off');
    }
    if (c.eventAutoSave === false) {
      eventAutoSaveEnabled.checked = false;
      eventAutoSaveToggleText.textContent = t('toggle.off');
    }
    if (c.eventOcrSettings) {
      const s = c.eventOcrSettings;
      if (s.scale != null) { eventOcrScaleSlider.value = s.scale; eventOcrScaleValue.textContent = s.scale + 'x'; }
      if (s.greyscale != null) { eventOcrGreyscaleCheckbox.checked = s.greyscale; eventOcrGreyscaleText.textContent = s.greyscale ? t('toggle.on') : t('toggle.off'); }
      if (s.sharpen != null) { eventOcrSharpenSlider.value = s.sharpen; eventOcrSharpenValue.textContent = s.sharpen; }
      if (s.contrast != null) { eventOcrContrastSlider.value = s.contrast; eventOcrContrastValue.textContent = s.contrast; }
      if (s.threshold != null) {
        if (s.threshold > 0) {
          eventOcrThresholdEnabled.checked = true;
          eventOcrThresholdText.textContent = t('toggle.on');
          eventOcrThresholdValSlider.disabled = false;
          eventOcrThresholdValSlider.value = s.threshold;
          eventOcrThresholdDisplay.textContent = s.threshold;
        } else {
          eventOcrThresholdEnabled.checked = false;
          eventOcrThresholdText.textContent = t('toggle.off');
          eventOcrThresholdValSlider.disabled = true;
        }
      }
      if (s.psm != null) eventOcrPsmSelect.value = s.psm;
      if (s.lang) eventOcrLangSelect.value = s.lang;
      if (s.minScore != null) eventOcrMinScoreInput.value = s.minScore;
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

  // Event-Toggle-Texte
  eventAutoOcrToggleText.textContent = eventAutoOcrEnabled.checked ? t('toggle.on') : t('toggle.off');
  eventAutoValidationToggleText.textContent = eventAutoValidationEnabled.checked ? t('toggle.on') : t('toggle.off');
  eventAutoSaveToggleText.textContent = eventAutoSaveEnabled.checked ? t('toggle.on') : t('toggle.off');
  eventOcrGreyscaleText.textContent = eventOcrGreyscaleCheckbox.checked ? t('toggle.on') : t('toggle.off');
  eventOcrThresholdText.textContent = eventOcrThresholdEnabled.checked ? t('toggle.on') : t('toggle.off');

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
  if (!eventRegion) {
    eventRegionInfo.textContent = t('status.noRegion');
  }

  // Event-OCR-Ergebnisse neu rendern
  if (eventOcrEntries) {
    renderEventOcrResults(eventOcrEntries);
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
      btnSelectEventRegion.disabled = false;
      updateCaptureButtons();
      updateEventCaptureButtons();
      // Auto-Login ausfuehren falls aktiviert (nur einmal pro Sitzung)
      if (!autoLoginAttempted && autoLoginEnabled.checked && loginEmail.value && loginPassword.value) {
        autoLoginAttempted = true;
        performAutoLogin();
      }
      // Gespeicherte Region: frischen Preview holen
      if (currentRegion) {
        loadSavedRegionPreview();
      }
      if (eventRegion) {
        loadSavedEventRegionPreview();
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
      btnSelectEventRegion.disabled = true;
      btnTestEventScroll.disabled = true;
      btnStartEventCapture.disabled = true;
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
  const defaultPath = lastOutputDir || outputDirInput.value || './captures/mitglieder';
  const result = await window.api.browseFolder({
    title: 'Capture-Ordner fuer OCR waehlen',
    defaultPath,
  });
  if (result.ok) {
    ocrFolderInput.value = result.path;
    saveCurrentConfig();
  }
});

btnOpenOcrFolder.addEventListener('click', () => {
  const folder = ocrFolderInput.value;
  if (folder) {
    window.api.openFolder(folder);
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
  validationMode = 'member';
  // Sync sub-tab bar state
  validationModeSubTabBar.querySelectorAll('.sub-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.subtab === 'validation-mode-member'));
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
    if (target === 'validation') {
      const hasMembers = ocrMembers && ocrMembers.length > 0;
      const hasEvents = eventOcrEntries && eventOcrEntries.length > 0;
      if ((hasMembers || hasEvents) && !validatedMembers) {
        // Default: validiere den zuletzt aktiven Modus
        if (hasEvents && !hasMembers) validationMode = 'event';
        // Sync sub-tab bar state
        validationModeSubTabBar.querySelectorAll('.sub-tab-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.subtab === (validationMode === 'event' ? 'validation-mode-event' : 'validation-mode-member')));
        validateCurrentResults();
      }
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

btnCopyLog.addEventListener('click', () => {
  const text = Array.from(logContainer.querySelectorAll('.log-entry'))
    .map(el => el.textContent)
    .join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const orig = btnCopyLog.textContent;
    btnCopyLog.textContent = t('btn.copied');
    setTimeout(() => { btnCopyLog.textContent = orig; }, 1500);
  });
});

btnOpenLogFolder.addEventListener('click', () => {
  window.api.openLogFolder();
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
  // Determine which data to validate based on mode
  const members = validationMode === 'event' ? eventOcrEntries : ocrMembers;
  if (!members || members.length === 0) {
    validationEmptyHint.style.display = 'block';
    validationOcrContent.style.display = 'none';
    validationSummary.textContent = '';
    return;
  }

  const options = validationMode === 'event' ? { mode: 'event' } : {};
  const result = await window.api.validateOcrResults(members, options);
  if (result.ok) {
    validatedMembers = result.members;
    validationEmptyHint.style.display = 'none';
    validationOcrContent.style.display = '';
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

  const isEvent = validationMode === 'event';

  // Update table header based on mode
  validationOcrHead.innerHTML = '';
  const headerTr = document.createElement('tr');
  if (isEvent) {
    headerTr.innerHTML = `
      <th class="th-checkbox"><input type="checkbox" id="validationSelectAll" title="Alle auswaehlen"></th>
      <th>${t('th.status')}</th>
      <th>${t('th.ocrName')}</th>
      <th>${t('th.correctionSuggestion')}</th>
      <th>${t('th.power')}</th>
      <th>${t('th.eventPoints')}</th>
      <th></th>
    `;
  } else {
    headerTr.innerHTML = `
      <th class="th-checkbox"><input type="checkbox" id="validationSelectAll" title="Alle auswaehlen"></th>
      <th>${t('th.status')}</th>
      <th>${t('th.ocrName')}</th>
      <th>${t('th.correctionSuggestion')}</th>
      <th>${t('th.coords')}</th>
      <th>${t('th.score')}</th>
      <th></th>
    `;
  }
  validationOcrHead.appendChild(headerTr);

  // Re-bind Select-All (since we recreated the header)
  const newSelectAll = validationOcrHead.querySelector('#validationSelectAll');

  // Track which corrections are actively used in current results
  activeCorrections.clear();
  validatedMembers.forEach(m => {
    if (m.validationStatus === 'corrected' && m.originalName && m.originalName !== m.name) {
      activeCorrections.add(m.originalName);
    }
  });

  const statusLabels = {
    confirmed: t('validation.confirmed'),
    corrected: t('validation.corrected'),
    suggested: t('validation.suggested'),
    unknown: t('validation.unknown'),
  };

  // Sichtbare Indizes sammeln (fuer Select-All)
  const visibleIndices = [];
  const activeEntries = isEvent ? eventOcrEntries : ocrMembers;

  validatedMembers.forEach((m, idx) => {
    // Filter anwenden
    if (validationFilter !== 'all' && m.validationStatus !== validationFilter) return;

    visibleIndices.push(idx);

    const tr = document.createElement('tr');
    tr.className = `v-row-${m.validationStatus}`;
    if (selectedOcrRow === idx) tr.classList.add('selected');

    const statusLabel = statusLabels[m.validationStatus] || m.validationStatus;
    const isChecked = selectedOcrRows.has(idx) ? 'checked' : '';

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
    if (m.validationStatus !== 'corrected' && m.validationStatus !== 'confirmed') {
      actionHtml += ` <button class="v-action-btn make-correction" data-idx="${idx}" data-action="make-correction" title="${t('tooltip.makeCorrection')}">&#8644;</button>`;
    }
    actionHtml += ` <button class="v-action-btn" data-idx="${idx}" data-action="edit-name" title="${t('tooltip.editName')}">&#9998;</button>`;
    actionHtml += ` <button class="v-action-btn add-to-list" data-idx="${idx}" data-action="add-to-list" title="${t('tooltip.addToList')}">&#43;</button>`;

    // Score columns based on mode
    let scoreColumnsHtml = '';
    const srcEntry = activeEntries && activeEntries[idx];

    // Screenshot-Button: nur anzeigen wenn Quelldateien vorhanden
    if (srcEntry && srcEntry._sourceFiles && srcEntry._sourceFiles.length > 0) {
      const count = srcEntry._sourceFiles.length;
      const tipText = count === 1
        ? t('tooltip.openScreenshot')
        : t('tooltip.openScreenshots', { count });
      actionHtml += ` <button class="v-action-btn screenshot-btn" data-idx="${idx}" data-action="open-screenshot" title="${tipText}">&#128065;</button>`;
    }
    if (isEvent && srcEntry) {
      const hasWarning = srcEntry._warning;
      const powerEdited = srcEntry._powerEdited ? ' score-edited' : '';
      const epEdited = srcEntry._eventPointsEdited ? ' score-edited' : '';
      const warnClass = hasWarning ? ' score-warning' : '';
      const warnTitle = hasWarning ? t('tooltip.scoreWarning') : t('tooltip.clickToEdit');
      scoreColumnsHtml = `
        <td class="td-score${powerEdited}${warnClass}" data-idx="${idx}" data-field="power" title="${warnTitle}">${srcEntry.power.toLocaleString('de-DE')}</td>
        <td class="td-score${epEdited}${warnClass}" data-idx="${idx}" data-field="eventPoints" title="${warnTitle}">${srcEntry.eventPoints.toLocaleString('de-DE')}</td>
      `;
    } else if (!isEvent && srcEntry) {
      const coordsEdited = srcEntry._coordsEdited ? ' score-edited' : '';
      const scoreEdited = srcEntry._scoreEdited ? ' score-edited' : '';
      scoreColumnsHtml = `
        <td class="td-score${coordsEdited}" data-idx="${idx}" data-field="coords" title="${t('tooltip.clickToEdit')}">${escapeHtml(srcEntry.coords || '')}</td>
        <td class="td-score${scoreEdited}" data-idx="${idx}" data-field="score" title="${t('tooltip.clickToEdit')}">${(srcEntry.score || 0).toLocaleString('de-DE')}</td>
      `;
    } else {
      scoreColumnsHtml = isEvent ? '<td class="td-score">-</td><td class="td-score">-</td>' : '<td class="td-score">-</td><td class="td-score">-</td>';
    }

    tr.innerHTML = `
      <td class="td-checkbox"><input type="checkbox" class="v-row-checkbox" data-idx="${idx}" ${isChecked}></td>
      <td><span class="v-status v-status-${m.validationStatus}"></span> ${statusLabel}</td>
      <td>${escapeHtml(m.validationStatus === 'corrected' ? m.originalName : m.name)}</td>
      <td>${correctionHtml}</td>
      ${scoreColumnsHtml}
      <td class="td-actions">${actionHtml}</td>
    `;

    // Klick auf Zeile = Auswahl fuer Zuordnung (nicht auf Checkbox, Buttons oder Score-Zellen)
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.v-action-btn') || e.target.closest('.v-row-checkbox') || e.target.closest('.td-score')) return;
      selectedOcrRow = idx;
      renderValidationOcrTable();
    });

    validationOcrBody.appendChild(tr);
  });

  // Checkboxen verdrahten
  validationOcrBody.querySelectorAll('.v-row-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const idx = parseInt(cb.dataset.idx);
      if (cb.checked) {
        selectedOcrRows.add(idx);
      } else {
        selectedOcrRows.delete(idx);
      }
      updateBatchButtonState();
    });
  });

  // Select-All Checkbox aktualisieren und verdrahten
  if (newSelectAll) {
    const allChecked = visibleIndices.length > 0 && visibleIndices.every(i => selectedOcrRows.has(i));
    newSelectAll.checked = allChecked;
    newSelectAll.addEventListener('change', () => {
      const checkboxes = validationOcrBody.querySelectorAll('.v-row-checkbox');
      checkboxes.forEach(cb => {
        const idx = parseInt(cb.dataset.idx);
        if (newSelectAll.checked) {
          selectedOcrRows.add(idx);
          cb.checked = true;
        } else {
          selectedOcrRows.delete(idx);
          cb.checked = false;
        }
      });
      updateBatchButtonState();
    });
  }

  // Score-Zellen: Klick-zum-Bearbeiten
  validationOcrBody.querySelectorAll('.td-score').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      if (td.querySelector('input')) return; // already editing

      const idx = parseInt(td.dataset.idx);
      const field = td.dataset.field;
      if (isNaN(idx) || !field) return;

      const entry = activeEntries && activeEntries[idx];
      if (!entry) return;

      const currentValue = field === 'coords' ? (entry.coords || '') : (entry[field] || 0);
      const displayValue = field === 'coords' ? currentValue : currentValue.toString();

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'score-edit-input';
      input.value = displayValue;

      const originalHtml = td.innerHTML;
      td.innerHTML = '';
      td.appendChild(input);
      input.focus();
      input.select();

      const commitEdit = () => {
        const rawVal = input.value.trim();
        if (field === 'coords') {
          if (rawVal !== (entry.coords || '')) {
            entry.coords = rawVal;
            entry._coordsEdited = true;
          }
          td.textContent = entry.coords || '';
        } else {
          const parsed = parseInt(rawVal.replace(/[,.\u00A0\s]/g, ''));
          const numVal = isNaN(parsed) ? 0 : parsed;
          if (numVal !== entry[field]) {
            entry[field] = numVal;
            entry[`_${field}Edited`] = true;
          }
          td.textContent = entry[field].toLocaleString('de-DE');
        }
        if (entry[`_${field}Edited`]) {
          td.classList.add('score-edited');
        }
      };

      input.addEventListener('blur', commitEdit);
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          input.blur();
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          td.innerHTML = originalHtml;
        }
      });
    });
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
          if (activeEntries && activeEntries[idx]) activeEntries[idx].name = member.suggestion;
          await validateCurrentResults();
        }
      } else if (action === 'make-correction') {
        await makeOcrCorrection(idx);
      } else if (action === 'edit-name') {
        await editOcrEntryName(idx);
      } else if (action === 'add-to-list') {
        await addOcrNameToValidationList(idx);
      } else if (action === 'open-screenshot') {
        const entry = activeEntries && activeEntries[idx];
        if (entry && entry._sourceFiles) {
          for (const filePath of entry._sourceFiles) {
            await window.api.openScreenshot(filePath);
          }
        }
      }
    });
  });

  updateBatchButtonState();
}

/**
 * Aktualisiert den Zustand des Batch-Buttons.
 */
function updateBatchButtonState() {
  if (btnAddSelectedToList) {
    btnAddSelectedToList.disabled = selectedOcrRows.size === 0;
    if (selectedOcrRows.size > 0) {
      btnAddSelectedToList.textContent = t('btn.addSelectedToListCount', { count: selectedOcrRows.size });
    } else {
      btnAddSelectedToList.textContent = t('btn.addSelectedToList');
    }
  }
}

/**
 * Bearbeitet den Namen eines OCR-Eintrags (Edit-Dialog).
 */
async function editOcrEntryName(idx) {
  const member = validatedMembers[idx];
  if (!member) return;

  const currentName = member.originalName || member.name;
  const newName = await showInputDialog(t('prompt.editName'), currentName);
  if (newName === null || newName.trim() === '' || newName.trim() === currentName) return;

  const activeEntries = validationMode === 'event' ? eventOcrEntries : ocrMembers;
  if (activeEntries && activeEntries[idx]) activeEntries[idx].name = newName.trim();
  await validateCurrentResults();
}

/**
 * Erstellt eine Korrektur-Regel fuer einen OCR-Eintrag.
 * Der OCR-Name wird uebernommen, der Benutzer gibt den korrekten Namen ein.
 */
async function makeOcrCorrection(idx) {
  const member = validatedMembers[idx];
  if (!member) return;

  const ocrName = member.originalName || member.name;
  const correctName = await showInputDialog(t('prompt.makeCorrection', { name: ocrName }), member.suggestion || '');
  if (correctName === null || correctName.trim() === '' || correctName.trim() === ocrName) return;

  const trimmed = correctName.trim();
  await window.api.addCorrection(ocrName, trimmed);

  // Aktive Eintraege aktualisieren
  const activeEntries = validationMode === 'event' ? eventOcrEntries : ocrMembers;
  if (activeEntries && activeEntries[idx]) activeEntries[idx].name = trimmed;

  await loadValidationList();
  await validateCurrentResults();

  // Switch to corrections sub-tab to show the new correction
  const bar = document.getElementById('validationRightSubTabBar');
  if (bar) {
    bar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === 'validation-corrections'));
    bar.parentElement.querySelectorAll('.sub-tab-content').forEach(tc => tc.classList.toggle('active', tc.id === 'validation-corrections'));
  }
}

/**
 * Fuegt einen einzelnen OCR-Namen zur Validierungsliste hinzu (mit Edit-Dialog).
 */
async function addOcrNameToValidationList(idx) {
  const member = validatedMembers[idx];
  if (!member) return;

  const currentName = member.name;
  const nameToAdd = await showInputDialog(t('prompt.addToList'), currentName);
  if (nameToAdd === null || nameToAdd.trim() === '') return;

  const trimmed = nameToAdd.trim();

  // Duplikatpruefung
  if (validationKnownNames.includes(trimmed)) {
    alert(t('alert.nameAlreadyExists', { name: trimmed }));
    return;
  }

  await window.api.addValidationName(trimmed);
  await loadValidationList();
  if (validatedMembers) await validateCurrentResults();
}

/**
 * Fuegt alle ausgewaehlten OCR-Namen zur Validierungsliste hinzu (Batch).
 */
async function addSelectedOcrNamesToValidationList() {
  if (selectedOcrRows.size === 0 || !validatedMembers) return;

  const namesToAdd = [];
  const duplicates = [];

  for (const idx of selectedOcrRows) {
    const member = validatedMembers[idx];
    if (!member) continue;
    const name = member.name;
    if (validationKnownNames.includes(name)) {
      duplicates.push(name);
    } else if (!namesToAdd.includes(name)) {
      namesToAdd.push(name);
    }
  }

  if (namesToAdd.length === 0 && duplicates.length > 0) {
    alert(t('alert.allNamesAlreadyExist', { count: duplicates.length }));
    return;
  }

  let confirmMsg = t('confirm.addNamesToList', { count: namesToAdd.length });
  if (duplicates.length > 0) {
    confirmMsg += '\n\n' + t('alert.duplicatesSkipped', { count: duplicates.length, names: duplicates.join(', ') });
  }

  if (!confirm(confirmMsg)) return;

  for (const name of namesToAdd) {
    await window.api.addValidationName(name);
  }

  selectedOcrRows.clear();
  await loadValidationList();
  if (validatedMembers) await validateCurrentResults();
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
      const activeEntries = validationMode === 'event' ? eventOcrEntries : ocrMembers;
      if (activeEntries && activeEntries[selectedOcrRow]) activeEntries[selectedOcrRow].name = name;
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
  const allEntries = Object.entries(validationCorrections);
  const searchTerm = (correctionSearch ? correctionSearch.value.trim().toLowerCase() : '');

  // Filter by search term (match against both OCR name and corrected name)
  const entries = searchTerm
    ? allEntries.filter(([from, to]) =>
        from.toLowerCase().includes(searchTerm) || to.toLowerCase().includes(searchTerm))
    : allEntries;

  // Sort: active corrections first, then alphabetical
  entries.sort((a, b) => {
    const aActive = activeCorrections.has(a[0]) ? 0 : 1;
    const bActive = activeCorrections.has(b[0]) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a[0].localeCompare(b[0], 'de');
  });

  correctionCount.textContent = searchTerm
    ? `${entries.length}/${allEntries.length}`
    : `${allEntries.length}`;

  entries.forEach(([from, to]) => {
    const item = document.createElement('div');
    const isActive = activeCorrections.has(from);
    item.className = 'correction-item' + (isActive ? ' active-correction' : '');
    item.innerHTML = `
      <span class="correction-from" title="${escapeHtml(from)}">${escapeHtml(from)}</span>
      <span class="correction-arrow">&rarr;</span>
      <span class="correction-to" title="${escapeHtml(to)}">${escapeHtml(to)}</span>
      ${isActive ? '<span class="correction-active-badge" title="' + t('tooltip.correctionActive') + '">&#9679;</span>' : ''}
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

// Manuelle Korrektur hinzufuegen
btnAddManualCorrection.addEventListener('click', async () => {
  const from = correctionFromInput.value.trim();
  const to = correctionToInput.value.trim();
  if (!from || !to) return;
  if (from === to) return;

  await window.api.addCorrection(from, to);
  correctionFromInput.value = '';
  correctionToInput.value = '';
  await loadValidationList();
  if (validatedMembers) await validateCurrentResults();
});

// Enter-Taste in Korrektur-Eingabefeldern
correctionToInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnAddManualCorrection.click();
  }
});

correctionFromInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    correctionToInput.focus();
  }
});

// Filter-Buttons
validationFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    validationFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    validationFilter = btn.dataset.filter;
    selectedOcrRows.clear();
    renderValidationOcrTable();
  });
});

// Select-All Checkbox — wird dynamisch in renderValidationOcrTable() gebunden,
// da der Header bei jedem Render neu erstellt wird.

// Batch: Ausgewaehlte zur Validierungsliste hinzufuegen
btnAddSelectedToList.addEventListener('click', async () => {
  await addSelectedOcrNamesToValidationList();
});

// Suche in Namensliste
validationSearch.addEventListener('input', () => {
  renderValidationNames();
});

// Suche in Korrekturen-Liste
correctionSearch.addEventListener('input', () => {
  renderCorrections();
});

// Name hinzufuegen
btnAddValidationName.addEventListener('click', async () => {
  const name = await showInputDialog(t('prompt.addName'));
  if (name && name.trim()) {
    const trimmed = name.trim();
    // Duplikatpruefung
    if (validationKnownNames.includes(trimmed)) {
      alert(t('alert.nameAlreadyExists', { name: trimmed }));
      return;
    }
    await window.api.addValidationName(trimmed);
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

  const activeEntries = validationMode === 'event' ? eventOcrEntries : ocrMembers;
  for (const member of suggestions) {
    const ocrName = member.originalName || member.name;
    await window.api.addCorrection(ocrName, member.suggestion);
    // Aktive Eintraege aktualisieren
    const idx = validatedMembers.indexOf(member);
    if (idx >= 0 && activeEntries && activeEntries[idx]) activeEntries[idx].name = member.suggestion;
  }

  await validateCurrentResults();
});

// Korrigierte Ergebnisse als CSV exportieren
btnValidationExportCsv.addEventListener('click', async () => {
  if (validationMode === 'event') {
    const entriesToExport = eventOcrEntries;
    if (!entriesToExport || entriesToExport.length === 0) return;
    const defaultName = `event_${localDateString()}.csv`;
    const result = await window.api.exportEventCsv(entriesToExport, defaultName);
    if (result.ok) {
      validationSummary.textContent = t('status.eventCsvSaved', { path: result.path });
    }
  } else {
    const membersToExport = validatedMembers || ocrMembers;
    if (!membersToExport || membersToExport.length === 0) return;
    const defaultName = `mitglieder_${localDateString()}.csv`;
    const result = await window.api.exportCsv(membersToExport, defaultName);
    if (result.ok) {
      validationSummary.textContent = t('status.csvSaved', { path: result.path });
    }
  }
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
  const hasData = (validationMode === 'event')
    ? (eventOcrEntries && eventOcrEntries.length > 0)
    : (ocrMembers && ocrMembers.length > 0);
  if (hasData) {
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

    const typeLabel = entry.type === 'event' ? t('history.typeEvent') : t('history.typeMember');
    const countLabel = entry.type === 'event'
      ? t('format.eventPlayerCount', { count: entry.memberCount })
      : t('format.memberCount', { count: entry.memberCount });

    tr.innerHTML = `
      <td><span class="history-date">${dateFormatted}</span></td>
      <td><span class="validation-mode-badge mode-${entry.type || 'member'}">${typeLabel}</span></td>
      <td>${countLabel}</td>
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

  const type = result.type || 'member';
  if (type === 'event') {
    historyMembers = null;
    renderHistoryEventDetail(result.entries || [], fileName);
  } else {
    historyMembers = result.members;
    renderHistoryDetail(result.members, fileName);
  }
}

function renderHistoryDetail(members, fileName) {
  historyDetailSection.style.display = 'block';
  historyMemberTable.style.display = '';
  historyEventTable.style.display = 'none';

  const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';

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

  setTimeout(() => historyDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function renderHistoryEventDetail(entries, fileName) {
  historyDetailSection.style.display = 'block';
  historyMemberTable.style.display = 'none';
  historyEventTable.style.display = '';

  const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';

  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch
    ? new Date(dateMatch[1] + 'T00:00:00').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    : fileName;
  historyDetailTitle.textContent = t('history.resultTitle', { date: dateStr });
  historyDetailCount.textContent = t('format.eventPlayerCount', { count: entries.length });

  historyEventDetailBody.innerHTML = '';
  entries.forEach((e, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(e.name)}</td>
      <td>${e.power.toLocaleString('de-DE')}</td>
      <td>${e.eventPoints.toLocaleString('de-DE')}</td>
    `;
    historyEventDetailBody.appendChild(tr);
  });

  setTimeout(() => historyDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

btnRefreshHistory.addEventListener('click', () => loadHistory());

btnOpenResultsDir.addEventListener('click', () => {
  window.api.openResultsDir();
});

btnHistoryExportCsv.addEventListener('click', async () => {
  // Determine type from selectedHistoryFile prefix
  const isEvent = selectedHistoryFile && selectedHistoryFile.startsWith('event_');
  if (isEvent) {
    // Re-load and export as event CSV
    const result = await window.api.loadHistoryEntry(selectedHistoryFile);
    if (result.ok && result.entries) {
      const defaultName = selectedHistoryFile || `event_${localDateString()}.csv`;
      await window.api.exportEventCsv(result.entries, defaultName);
    }
  } else {
    if (!historyMembers || historyMembers.length === 0) return;
    const defaultName = selectedHistoryFile || `mitglieder_${localDateString()}.csv`;
    await window.api.exportCsv(historyMembers, defaultName);
  }
});

// ─── Sub-Tab Navigation ──────────────────────────────────────────────────────

subTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.subtab;
    // Spezialbehandlung: Validation Mode Sub-Tabs (Mitglieder/Event)
    if (btn.parentElement === validationModeSubTabBar) return; // handled separately below

    // Alle Sub-Tab-Buttons im gleichen Container deaktivieren
    const bar = btn.parentElement;
    bar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Sub-Tab-Inhalte im gleichen Eltern-Tab umschalten
    const parentTab = bar.parentElement;
    parentTab.querySelectorAll('.sub-tab-content').forEach(tc => {
      tc.classList.toggle('active', tc.id === target);
    });
  });
});

// ─── Validation Mode Sub-Tab (Mitglieder / Event) ─────────────────────────
validationModeSubTabBar.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const target = btn.dataset.subtab;
    validationModeSubTabBar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const newMode = target === 'validation-mode-event' ? 'event' : 'member';
    if (newMode !== validationMode) {
      validationMode = newMode;
      // Reset selection state
      selectedOcrRow = null;
      selectedOcrRows.clear();
      validatedMembers = null;
      // Re-validate with new mode's data
      await validateCurrentResults();
    }
  });
});

// ─── Event Region ────────────────────────────────────────────────────────────

btnSelectEventRegion.addEventListener('click', async () => {
  btnSelectEventRegion.disabled = true;
  eventRegionInfo.textContent = t('status.selectInBrowser');

  const result = await window.api.selectEventRegion();
  btnSelectEventRegion.disabled = false;

  if (result.ok) {
    eventRegion = result.region;
    const r = result.region;
    eventRegionInfo.textContent = `${r.width} x ${r.height} @ (${r.x}, ${r.y})`;

    if (result.preview) {
      eventRegionPreview.src = `data:image/png;base64,${result.preview}`;
      eventRegionPreviewContainer.style.display = 'block';
    }

    updateEventCaptureButtons();
    saveCurrentConfig();
  } else {
    eventRegionInfo.textContent = t('status.error', { error: result.error });
  }
});

async function loadSavedEventRegionPreview() {
  if (!eventRegion || !browserReady) return;
  const r = eventRegion;
  eventRegionInfo.textContent = t('status.loadingPreview', { w: r.width, h: r.height, x: r.x, y: r.y });

  const result = await window.api.previewEventRegion(eventRegion);
  if (result.ok) {
    eventRegionPreview.src = `data:image/png;base64,${result.preview}`;
    eventRegionPreviewContainer.style.display = 'block';
    eventRegionInfo.textContent = t('status.regionSaved', { w: r.width, h: r.height, x: r.x, y: r.y });
  } else {
    eventRegionInfo.textContent = t('status.previewFailed', { w: r.width, h: r.height, x: r.x, y: r.y });
  }
}

// ─── Event Kalibrierung ──────────────────────────────────────────────────────

eventScrollTicksSlider.addEventListener('input', () => {
  eventScrollTicksValue.textContent = eventScrollTicksSlider.value;
});
eventScrollTicksSlider.addEventListener('change', saveCurrentConfig);

eventScrollDelaySlider.addEventListener('input', () => {
  eventScrollDelayValue.textContent = eventScrollDelaySlider.value;
});
eventScrollDelaySlider.addEventListener('change', saveCurrentConfig);

eventMaxScreenshotsInput.addEventListener('change', saveCurrentConfig);
eventOutputDirInput.addEventListener('change', saveCurrentConfig);

btnBrowseEventDir.addEventListener('click', async () => {
  const result = await window.api.browseFolder();
  if (result.ok) {
    eventOutputDirInput.value = result.path;
    saveCurrentConfig();
  }
});

btnOpenEventOutputDir.addEventListener('click', () => {
  window.api.openFolder(eventOutputDirInput.value);
});

btnTestEventScroll.addEventListener('click', async () => {
  if (!eventRegion) return;

  btnTestEventScroll.disabled = true;
  eventTestInfo.textContent = t('status.scrolling');

  const result = await window.api.testEventScroll({
    region: eventRegion,
    scrollTicks: parseInt(eventScrollTicksSlider.value),
    scrollDelay: parseInt(eventScrollDelaySlider.value),
  });

  btnTestEventScroll.disabled = false;

  if (result.ok) {
    const diff = ((1 - result.similarity) * 100).toFixed(1);
    eventTestInfo.textContent = t('status.difference', { pct: diff });
    eventTestBefore.src = `data:image/png;base64,${result.before}`;
    eventTestAfter.src = `data:image/png;base64,${result.after}`;
    eventTestPreviewContainer.style.display = 'flex';
  } else {
    eventTestInfo.textContent = t('status.error', { error: result.error });
  }
});

function updateEventCaptureButtons() {
  const ready = browserReady && eventRegion;
  btnTestEventScroll.disabled = !ready;
  btnStartEventCapture.disabled = !ready || eventCapturing;
}

// ─── Event Capture ──────────────────────────────────────────────────────────

btnStartEventCapture.addEventListener('click', async () => {
  if (!eventRegion || !browserReady) return;

  eventCapturing = true;
  btnStartEventCapture.disabled = true;
  btnStopEventCapture.disabled = false;
  eventProgressContainer.style.display = 'flex';
  eventProgressFill.style.width = '0%';
  eventProgressText.textContent = '0 / ' + eventMaxScreenshotsInput.value;
  eventGallery.innerHTML = '';
  eventGallerySection.style.display = 'block';
  eventCaptureResult.textContent = '';

  switchToTab('capture');
  // Switch to event sub-tab
  const captureBar = $('#captureSubTabBar');
  captureBar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === 'capture-event'));
  captureBar.parentElement.querySelectorAll('.sub-tab-content').forEach(tc => tc.classList.toggle('active', tc.id === 'capture-event'));
  setTimeout(() => eventGallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  saveCurrentConfig();

  await window.api.startEventCapture({
    region: eventRegion,
    scrollTicks: parseInt(eventScrollTicksSlider.value),
    scrollDelay: parseInt(eventScrollDelaySlider.value),
    maxScreenshots: parseInt(eventMaxScreenshotsInput.value),
    outputDir: eventOutputDirInput.value,
  });
});

btnStopEventCapture.addEventListener('click', async () => {
  await window.api.stopEventCapture();
  btnStopEventCapture.disabled = true;
});

window.api.onEventCaptureProgress((data) => {
  const max = data.max || parseInt(eventMaxScreenshotsInput.value);
  const pct = Math.round((data.count / max) * 100);
  eventProgressFill.style.width = pct + '%';
  eventProgressText.textContent = `${data.count} / ${max}`;

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
    eventGallery.appendChild(item);
    eventGallery.scrollTop = eventGallery.scrollHeight;
  }

  if (data.status === 'end-detected') {
    while (eventGallery.children.length > data.count) {
      eventGallery.removeChild(eventGallery.lastChild);
    }
    eventProgressText.textContent = `${data.count} / ${max}`;
    eventCaptureResult.textContent = t('status.listEndDetected', { count: data.count });
  }
});

window.api.onEventCaptureDone((data) => {
  eventCapturing = false;
  btnStartEventCapture.disabled = false;
  btnStopEventCapture.disabled = true;
  eventLastOutputDir = data.outputDir;

  eventCaptureResult.textContent = t('status.captureComplete', { count: data.count, dir: data.outputDir });
  eventProgressFill.style.width = '100%';

  eventOcrFolderInput.value = data.outputDir;

  if (eventAutoOcrEnabled.checked && data.count > 0) {
    startEventOcr(data.outputDir);
  }
});

btnOpenEventFolder.addEventListener('click', () => {
  if (eventLastOutputDir) {
    window.api.openFolder(eventLastOutputDir);
  }
});

btnDeleteEventCapture.addEventListener('click', async () => {
  if (!eventLastOutputDir) return;

  const ok = confirm(t('confirm.deleteCapture', { path: eventLastOutputDir }));
  if (!ok) return;

  const result = await window.api.deleteFolder(eventLastOutputDir);
  if (result.ok) {
    eventGallerySection.style.display = 'none';
    eventGallery.innerHTML = '';
    eventCaptureResult.textContent = '';
    eventLastOutputDir = null;
    eventOcrFolderInput.value = '';
    eventOcrResultContainer.style.display = 'none';
    eventOcrTableBody.innerHTML = '';
    eventOcrEntries = null;
  }
});

// ─── Event OCR Auswertung ───────────────────────────────────────────────────

eventAutoOcrEnabled.addEventListener('change', () => {
  eventAutoOcrToggleText.textContent = eventAutoOcrEnabled.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

eventAutoValidationEnabled.addEventListener('change', () => {
  eventAutoValidationToggleText.textContent = eventAutoValidationEnabled.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

eventAutoSaveEnabled.addEventListener('change', () => {
  eventAutoSaveToggleText.textContent = eventAutoSaveEnabled.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

// Event OCR Einstellungen Event-Listener
eventOcrScaleSlider.addEventListener('input', () => {
  eventOcrScaleValue.textContent = eventOcrScaleSlider.value + 'x';
});
eventOcrScaleSlider.addEventListener('change', saveCurrentConfig);

eventOcrGreyscaleCheckbox.addEventListener('change', () => {
  eventOcrGreyscaleText.textContent = eventOcrGreyscaleCheckbox.checked ? t('toggle.on') : t('toggle.off');
  saveCurrentConfig();
});

eventOcrSharpenSlider.addEventListener('input', () => {
  eventOcrSharpenValue.textContent = eventOcrSharpenSlider.value;
});
eventOcrSharpenSlider.addEventListener('change', saveCurrentConfig);

eventOcrContrastSlider.addEventListener('input', () => {
  eventOcrContrastValue.textContent = eventOcrContrastSlider.value;
});
eventOcrContrastSlider.addEventListener('change', saveCurrentConfig);

eventOcrThresholdEnabled.addEventListener('change', () => {
  const on = eventOcrThresholdEnabled.checked;
  eventOcrThresholdText.textContent = on ? t('toggle.on') : t('toggle.off');
  eventOcrThresholdValSlider.disabled = !on;
  saveCurrentConfig();
});
eventOcrThresholdValSlider.addEventListener('input', () => {
  eventOcrThresholdDisplay.textContent = eventOcrThresholdValSlider.value;
});
eventOcrThresholdValSlider.addEventListener('change', saveCurrentConfig);

eventOcrPsmSelect.addEventListener('change', saveCurrentConfig);
eventOcrLangSelect.addEventListener('change', saveCurrentConfig);
eventOcrMinScoreInput.addEventListener('change', saveCurrentConfig);

btnGoToEventValidation.addEventListener('click', () => {
  validationMode = 'event';
  // Sync sub-tab bar state
  validationModeSubTabBar.querySelectorAll('.sub-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.subtab === 'validation-mode-event'));
  switchToTab('validation');
  validateCurrentResults();
});

btnBrowseEventOcrFolder.addEventListener('click', async () => {
  const defaultPath = eventLastOutputDir || eventOutputDirInput.value || './captures/events';
  const result = await window.api.browseFolder({
    title: 'Event-Capture-Ordner fuer OCR waehlen',
    defaultPath,
  });
  if (result.ok) {
    eventOcrFolderInput.value = result.path;
    saveCurrentConfig();
  }
});

btnOpenEventOcrFolder.addEventListener('click', () => {
  const folder = eventOcrFolderInput.value;
  if (folder) {
    window.api.openFolder(folder);
  }
});

btnStartEventOcr.addEventListener('click', () => startEventOcr());

btnStopEventOcr.addEventListener('click', async () => {
  await window.api.stopEventOcr();
  btnStopEventOcr.disabled = true;
});

btnExportEventCsv.addEventListener('click', async () => {
  if (!eventOcrEntries || eventOcrEntries.length === 0) return;
  const defaultName = `event_${localDateString()}.csv`;
  const result = await window.api.exportEventCsv(eventOcrEntries, defaultName);
  if (result.ok) {
    eventOcrStatus.textContent = t('status.eventCsvSaved', { path: result.path });
  }
});

function getEventOcrSettings() {
  return {
    scale: parseFloat(eventOcrScaleSlider.value),
    greyscale: eventOcrGreyscaleCheckbox.checked,
    sharpen: parseFloat(eventOcrSharpenSlider.value),
    contrast: parseFloat(eventOcrContrastSlider.value),
    threshold: eventOcrThresholdEnabled.checked ? parseInt(eventOcrThresholdValSlider.value) : 0,
    psm: parseInt(eventOcrPsmSelect.value),
    lang: eventOcrLangSelect.value,
    minScore: parseInt(eventOcrMinScoreInput.value) || 5000,
  };
}

async function startEventOcr(folderPath) {
  const folder = folderPath || eventOcrFolderInput.value;
  if (!folder) {
    eventOcrStatus.textContent = t('status.noFolder');
    return;
  }

  eventOcrRunning = true;
  eventOcrEntries = null;
  btnStartEventOcr.disabled = true;
  btnStopEventOcr.disabled = false;
  eventOcrStatus.textContent = t('status.initOcr');
  eventOcrProgressContainer.style.display = 'flex';
  eventOcrProgressFill.style.width = '0%';
  eventOcrProgressText.textContent = '0 / ?';
  eventOcrResultContainer.style.display = 'none';
  eventOcrTableBody.innerHTML = '';

  switchToTab('capture');
  // Switch to event sub-tab
  const captureBar = $('#captureSubTabBar');
  captureBar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === 'capture-event'));
  captureBar.parentElement.querySelectorAll('.sub-tab-content').forEach(tc => tc.classList.toggle('active', tc.id === 'capture-event'));
  setTimeout(() => eventAuswertungSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  const result = await window.api.startEventOcr(folder, getEventOcrSettings());

  eventOcrRunning = false;
  btnStartEventOcr.disabled = false;
  btnStopEventOcr.disabled = true;

  if (result.ok) {
    eventOcrStatus.textContent = t('status.eventMembersDetected', { count: result.entries.length });
    eventOcrProgressFill.style.width = '100%';
  } else {
    eventOcrStatus.textContent = t('status.error', { error: result.error });
  }
}

window.api.onEventOcrProgress((data) => {
  const pct = Math.round((data.current / data.total) * 100);
  eventOcrProgressFill.style.width = pct + '%';
  eventOcrProgressText.textContent = `${data.current} / ${data.total}`;
  eventOcrStatus.textContent = t('status.processing', { file: data.file });
});

window.api.onEventOcrDone(async (data) => {
  eventOcrEntries = data.entries;
  renderEventOcrResults(data.entries);

  // Auto-Validierung fuer Events
  if (eventAutoValidationEnabled.checked && validationKnownNames.length > 0) {
    validationMode = 'event';
    // Sync sub-tab bar state
    validationModeSubTabBar.querySelectorAll('.sub-tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.subtab === 'validation-mode-event'));
    await validateEventResults();
    showEventOcrValidationBanner();

    // Auto-Save
    if (eventAutoSaveEnabled.checked && eventOcrEntries) {
      await autoSaveEventCsv();
    }
  }
});

function renderEventOcrResults(entries) {
  eventOcrResultContainer.style.display = 'block';
  eventOcrResultCount.textContent = t('result.eventPlayersFound', { count: entries.length });
  eventOcrTableBody.innerHTML = '';

  entries.forEach((e, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(e.name)}</td>
      <td>${e.power.toLocaleString('de-DE')}</td>
      <td>${e.eventPoints.toLocaleString('de-DE')}</td>
    `;
    eventOcrTableBody.appendChild(tr);
  });
}

async function validateEventResults() {
  if (!eventOcrEntries || eventOcrEntries.length === 0) return;

  const result = await window.api.validateOcrResults(eventOcrEntries, { mode: 'event' });
  if (result.ok) {
    // Merge validation status back into eventOcrEntries for display
    validatedMembers = result.members;
    validationMode = 'event';
    validationEmptyHint.style.display = 'none';
    validationOcrContent.style.display = '';
    renderValidationOcrTable();
    updateValidationSummary();
  }
}

function showEventOcrValidationBanner() {
  if (!validatedMembers || !eventAutoValidationEnabled.checked) {
    eventOcrValidationBanner.style.display = 'none';
    return;
  }

  const counts = { confirmed: 0, corrected: 0, suggested: 0, unknown: 0 };
  validatedMembers.forEach(m => counts[m.validationStatus]++);
  const total = validatedMembers.length;
  const ok = counts.confirmed + counts.corrected;
  const errors = counts.suggested + counts.unknown;

  eventOcrValidationBanner.style.display = 'flex';

  if (errors === 0) {
    eventOcrValidationBanner.className = 'ocr-validation-banner banner-success';
    eventOcrValidationIcon.textContent = '\u2714';
    eventOcrValidationMsg.textContent = t('validation.bannerSuccess', { total });
    btnGoToEventValidation.style.display = 'none';
    eventOcrStatus.textContent = t('status.allValidated', { total });
  } else if (counts.unknown > 0) {
    eventOcrValidationBanner.className = 'ocr-validation-banner banner-error';
    eventOcrValidationIcon.textContent = '\u2716';
    eventOcrValidationMsg.textContent = t('validation.bannerError', {
      errors, unknown: counts.unknown, suggested: counts.suggested, ok, total,
    });
    btnGoToEventValidation.style.display = '';
    eventOcrStatus.textContent = t('status.validationErrors', { total, errors });
  } else {
    eventOcrValidationBanner.className = 'ocr-validation-banner banner-warning';
    eventOcrValidationIcon.textContent = '\u26A0';
    eventOcrValidationMsg.textContent = t('validation.bannerWarning', {
      suggested: counts.suggested, ok, total,
    });
    btnGoToEventValidation.style.display = '';
    eventOcrStatus.textContent = t('status.validationSuggestions', { total, suggested: counts.suggested });
  }
}

async function autoSaveEventCsv() {
  if (!eventOcrEntries || eventOcrEntries.length === 0) return;

  const result = await window.api.autoSaveEventCsv(eventOcrEntries);
  if (result.ok) {
    eventOcrStatus.textContent += ` ${t('status.eventCsvAutoSaved', { fileName: result.fileName })}`;
  }
}

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
    // Event-Einstellungen
    eventRegion: eventRegion,
    eventScrollTicks: parseInt(eventScrollTicksSlider.value),
    eventScrollDelay: parseInt(eventScrollDelaySlider.value),
    eventMaxScreenshots: parseInt(eventMaxScreenshotsInput.value),
    eventOutputDir: eventOutputDirInput.value,
    eventAutoOcr: eventAutoOcrEnabled.checked,
    eventAutoValidation: eventAutoValidationEnabled.checked,
    eventAutoSave: eventAutoSaveEnabled.checked,
    eventOcrFolder: eventOcrFolderInput.value,
    eventOcrSettings: getEventOcrSettings(),
  });
}
