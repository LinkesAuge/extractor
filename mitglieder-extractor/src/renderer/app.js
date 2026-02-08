// ─── DOM Elemente ───────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

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
const captureResult = $('#captureResult');

const autoLoginEnabled = $('#autoLoginEnabled');
const autoLoginToggleText = $('#autoLoginToggleText');
const loginFields = $('#loginFields');
const loginEmail = $('#loginEmail');
const loginPassword = $('#loginPassword');
const btnTogglePassword = $('#btnTogglePassword');

const logContainer = $('#logContainer');

// OCR Auswertung
const autoOcrEnabled = $('#autoOcrEnabled');
const autoOcrToggleText = $('#autoOcrToggleText');
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

// OCR Einstellungen
const btnToggleOcrSettings = $('#btnToggleOcrSettings');
const ocrSettingsPanel = $('#ocrSettingsPanel');
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

// ─── State ──────────────────────────────────────────────────────────────────

let currentRegion = null;
let browserReady = false;
let capturing = false;
let lastOutputDir = null;
let autoLoginAttempted = false;
let ocrRunning = false;
let ocrMembers = null;  // letzte OCR-Ergebnisse

// ─── Init: Config laden ─────────────────────────────────────────────────────

(async () => {
  const result = await window.api.loadConfig();
  if (result.ok && result.config) {
    const c = result.config;
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
      autoLoginToggleText.textContent = 'An';
    }
    // autoOcr: explizit false beachten, sonst HTML-Default (checked)
    if (c.autoOcr === false) {
      autoOcrEnabled.checked = false;
      autoOcrToggleText.textContent = 'Aus';
    }
    if (c.ocrFolder) ocrFolderInput.value = c.ocrFolder;

    // OCR-Einstellungen wiederherstellen
    if (c.ocrSettings) {
      const s = c.ocrSettings;
      if (s.scale != null) { ocrScaleSlider.value = s.scale; ocrScaleValue.textContent = s.scale + 'x'; }
      if (s.greyscale != null) { ocrGreyscaleCheckbox.checked = s.greyscale; ocrGreyscaleText.textContent = s.greyscale ? 'An' : 'Aus'; }
      if (s.sharpen != null) { ocrSharpenSlider.value = s.sharpen; ocrSharpenValue.textContent = s.sharpen; }
      if (s.contrast != null) { ocrContrastSlider.value = s.contrast; ocrContrastValue.textContent = s.contrast; }
      if (s.threshold > 0) {
        ocrThresholdEnabled.checked = true;
        ocrThresholdText.textContent = 'An';
        ocrThresholdValSlider.disabled = false;
        ocrThresholdValSlider.value = s.threshold;
        ocrThresholdDisplay.textContent = s.threshold;
      }
      if (s.psm != null) ocrPsmSelect.value = s.psm;
      if (s.lang) ocrLangSelect.value = s.lang;
      if (s.minScore != null) ocrMinScoreInput.value = s.minScore;
    }
  }
})();

// ─── Login Toggle ───────────────────────────────────────────────────────────

autoLoginEnabled.addEventListener('change', () => {
  const on = autoLoginEnabled.checked;
  loginFields.style.display = on ? 'block' : 'none';
  autoLoginToggleText.textContent = on ? 'An' : 'Aus';
  saveCurrentConfig();
});

btnTogglePassword.addEventListener('click', () => {
  const isPassword = loginPassword.type === 'password';
  loginPassword.type = isPassword ? 'text' : 'password';
  btnTogglePassword.textContent = isPassword ? 'Verbergen' : 'Zeigen';
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
  browserStatus.textContent = 'Starte Browser...';
  browserStatus.className = 'status-bar working';

  const result = await window.api.launchBrowser(urlInput.value);
  if (!result.ok) {
    browserStatus.textContent = `Fehler: ${result.error}`;
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
      browserStatus.textContent = 'Browser startet...';
      browserStatus.className = 'status-bar working';
      break;
    case 'navigating':
      browserStatus.textContent = 'Navigiere zur Seite...';
      browserStatus.className = 'status-bar working';
      break;
    case 'ready':
      browserStatus.textContent = `Bereit: ${data.title || 'Seite geladen'}`;
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
      browserStatus.textContent = 'Browser geschlossen';
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
      browserStatus.textContent = `Fehler: ${data.error}`;
      browserStatus.className = 'status-bar error';
      btnLaunch.disabled = false;
      break;
  }
});

// ─── Region ─────────────────────────────────────────────────────────────────

btnSelectRegion.addEventListener('click', async () => {
  btnSelectRegion.disabled = true;
  regionInfo.textContent = 'Waehle im Browser-Fenster...';

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
    regionInfo.textContent = `Fehler: ${result.error}`;
  }
});

// ─── Kalibrierung ───────────────────────────────────────────────────────────

btnTestScroll.addEventListener('click', async () => {
  if (!currentRegion) return;

  btnTestScroll.disabled = true;
  testInfo.textContent = 'Scrolle...';

  const result = await window.api.testScroll({
    region: currentRegion,
    scrollTicks: parseInt(scrollTicksSlider.value),
    scrollDelay: parseInt(scrollDelaySlider.value),
  });

  btnTestScroll.disabled = false;

  if (result.ok) {
    const diff = ((1 - result.similarity) * 100).toFixed(1);
    testInfo.textContent = `Unterschied: ${diff}%`;

    testBefore.src = `data:image/png;base64,${result.before}`;
    testAfter.src = `data:image/png;base64,${result.after}`;
    testPreviewContainer.style.display = 'flex';
  } else {
    testInfo.textContent = `Fehler: ${result.error}`;
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

  // Zur Galerie scrollen
  gallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
    captureResult.textContent = `Listenende erkannt! ${data.count} einzigartige Screenshots.`;
  }
});

window.api.onCaptureDone((data) => {
  capturing = false;
  btnStartCapture.disabled = false;
  btnStopCapture.disabled = true;
  lastOutputDir = data.outputDir;

  captureResult.textContent = `Fertig! ${data.count} Screenshots in ${data.outputDir}`;
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
  autoOcrToggleText.textContent = autoOcrEnabled.checked ? 'An' : 'Aus';
  saveCurrentConfig();
});

// OCR Einstellungen Panel Toggle
btnToggleOcrSettings.addEventListener('click', () => {
  const visible = ocrSettingsPanel.style.display !== 'none';
  ocrSettingsPanel.style.display = visible ? 'none' : 'block';
  btnToggleOcrSettings.textContent = visible ? 'Einstellungen' : 'Einstellungen verbergen';
});

// OCR Einstellungen Event-Listener
ocrScaleSlider.addEventListener('input', () => {
  ocrScaleValue.textContent = ocrScaleSlider.value + 'x';
});
ocrScaleSlider.addEventListener('change', saveCurrentConfig);

ocrGreyscaleCheckbox.addEventListener('change', () => {
  ocrGreyscaleText.textContent = ocrGreyscaleCheckbox.checked ? 'An' : 'Aus';
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
  ocrThresholdText.textContent = on ? 'An' : 'Aus';
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

btnBrowseOcrFolder.addEventListener('click', async () => {
  const result = await window.api.browseFolder();
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

  const defaultName = `mitglieder_${new Date().toISOString().slice(0, 10)}.csv`;
  const result = await window.api.exportCsv(ocrMembers, defaultName);
  if (result.ok) {
    ocrStatus.textContent = `CSV gespeichert: ${result.path}`;
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
    ocrStatus.textContent = 'Kein Ordner angegeben.';
    return;
  }

  ocrRunning = true;
  ocrMembers = null;
  btnStartOcr.disabled = true;
  btnStopOcr.disabled = false;
  ocrStatus.textContent = 'Initialisiere OCR...';
  ocrProgressContainer.style.display = 'flex';
  ocrProgressFill.style.width = '0%';
  ocrProgressText.textContent = '0 / ?';
  ocrResultContainer.style.display = 'none';
  ocrTableBody.innerHTML = '';

  // Zur Auswertung scrollen
  auswertungSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const result = await window.api.startOcr(folder, getOcrSettings());

  ocrRunning = false;
  btnStartOcr.disabled = false;
  btnStopOcr.disabled = true;

  if (result.ok) {
    ocrStatus.textContent = `${result.members.length} Mitglieder erkannt.`;
    ocrProgressFill.style.width = '100%';
  } else {
    ocrStatus.textContent = `Fehler: ${result.error}`;
  }
}

window.api.onOcrProgress((data) => {
  const pct = Math.round((data.current / data.total) * 100);
  ocrProgressFill.style.width = pct + '%';
  ocrProgressText.textContent = `${data.current} / ${data.total}`;
  ocrStatus.textContent = `Verarbeite ${data.file}...`;
});

window.api.onOcrDone((data) => {
  ocrMembers = data.members;
  renderOcrResults(data.members);
});

function renderOcrResults(members) {
  ocrResultContainer.style.display = 'block';
  ocrResultCount.textContent = `${members.length} Mitglieder gefunden`;
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function updateCaptureButtons() {
  const ready = browserReady && currentRegion;
  btnTestScroll.disabled = !ready;
  btnStartCapture.disabled = !ready || capturing;
}

async function performAutoLogin() {
  browserStatus.textContent = 'Auto-Login...';
  browserStatus.className = 'status-bar working';

  const result = await window.api.autoLogin({
    email: loginEmail.value,
    password: loginPassword.value,
  });

  if (result.ok) {
    browserStatus.textContent = 'Eingeloggt - Spiel laedt...';
    browserStatus.className = 'status-bar ready';
  } else {
    browserStatus.textContent = `Login fehlgeschlagen: ${result.error}`;
    browserStatus.className = 'status-bar error';
    browserReady = true;
    btnSelectRegion.disabled = false;
    updateCaptureButtons();
  }
}

async function loadSavedRegionPreview() {
  if (!currentRegion || !browserReady) return;
  regionInfo.textContent = `Lade Preview fuer ${currentRegion.width} x ${currentRegion.height} @ (${currentRegion.x}, ${currentRegion.y})...`;

  const result = await window.api.previewRegion(currentRegion);
  if (result.ok) {
    regionPreview.src = `data:image/png;base64,${result.preview}`;
    regionPreviewContainer.style.display = 'block';
    regionInfo.textContent = `${currentRegion.width} x ${currentRegion.height} @ (${currentRegion.x}, ${currentRegion.y}) — gespeichert`;
  } else {
    regionInfo.textContent = `${currentRegion.width} x ${currentRegion.height} @ (${currentRegion.x}, ${currentRegion.y}) — Preview fehlgeschlagen`;
  }
}

async function saveCurrentConfig() {
  await window.api.saveConfig({
    region: currentRegion,
    scrollTicks: parseInt(scrollTicksSlider.value),
    scrollDelay: parseInt(scrollDelaySlider.value),
    maxScreenshots: parseInt(maxScreenshotsInput.value),
    outputDir: outputDirInput.value,
    autoLogin: autoLoginEnabled.checked,
    loginEmail: loginEmail.value,
    loginPassword: loginPassword.value,
    autoOcr: autoOcrEnabled.checked,
    ocrFolder: ocrFolderInput.value,
    ocrSettings: getOcrSettings(),
  });
}
