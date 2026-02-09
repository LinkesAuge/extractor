const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Browser-Steuerung
  launchBrowser: (url) => ipcRenderer.invoke('launch-browser', url),
  closeBrowser: () => ipcRenderer.invoke('close-browser'),

  // Login
  autoLogin: (credentials) => ipcRenderer.invoke('auto-login', credentials),

  // Region
  selectRegion: () => ipcRenderer.invoke('select-region'),

  // Kalibrierung
  testScroll: (options) => ipcRenderer.invoke('test-scroll', options),

  // Capture
  startCapture: (options) => ipcRenderer.invoke('start-capture', options),
  stopCapture: () => ipcRenderer.invoke('stop-capture'),

  // Region Preview
  previewRegion: (region) => ipcRenderer.invoke('preview-region', region),

  // Config
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Ordner oeffnen / waehlen / loeschen
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  openResultsDir: () => ipcRenderer.invoke('open-results-dir'),
  browseFolder: (options) => ipcRenderer.invoke('browse-folder', options),
  browseCaptureFolder: (defaultPath) => ipcRenderer.invoke('browse-capture-folder', defaultPath),
  deleteFolder: (path) => ipcRenderer.invoke('delete-folder', path),

  // OCR Auswertung
  startOcr: (folderPath, settings) => ipcRenderer.invoke('start-ocr', folderPath, settings),
  stopOcr: () => ipcRenderer.invoke('stop-ocr'),
  exportCsv: (members, defaultName) => ipcRenderer.invoke('export-csv', members, defaultName),
  autoSaveCsv: (members) => ipcRenderer.invoke('auto-save-csv', members),

  // History
  loadHistory: () => ipcRenderer.invoke('load-history'),
  loadHistoryEntry: (fileName) => ipcRenderer.invoke('load-history-entry', fileName),
  deleteHistoryEntry: (fileName) => ipcRenderer.invoke('delete-history-entry', fileName),

  // Validierungsliste
  loadValidationList: () => ipcRenderer.invoke('load-validation-list'),
  saveValidationList: () => ipcRenderer.invoke('save-validation-list'),
  addValidationName: (name) => ipcRenderer.invoke('add-validation-name', name),
  removeValidationName: (name) => ipcRenderer.invoke('remove-validation-name', name),
  addCorrection: (ocrName, correctName) => ipcRenderer.invoke('add-correction', ocrName, correctName),
  removeCorrection: (ocrName) => ipcRenderer.invoke('remove-correction', ocrName),
  validateOcrResults: (members) => ipcRenderer.invoke('validate-ocr-results', members),
  importValidationList: () => ipcRenderer.invoke('import-validation-list'),
  exportValidationList: () => ipcRenderer.invoke('export-validation-list'),

  // Events vom Main Process empfangen
  onBrowserStatus: (callback) => {
    ipcRenderer.on('browser-status', (_e, data) => callback(data));
  },
  onCaptureProgress: (callback) => {
    ipcRenderer.on('capture-progress', (_e, data) => callback(data));
  },
  onCaptureDone: (callback) => {
    ipcRenderer.on('capture-done', (_e, data) => callback(data));
  },
  onOcrProgress: (callback) => {
    ipcRenderer.on('ocr-progress', (_e, data) => callback(data));
  },
  onOcrDone: (callback) => {
    ipcRenderer.on('ocr-done', (_e, data) => callback(data));
  },
  onLog: (callback) => {
    ipcRenderer.on('log', (_e, data) => callback(data));
  },
});
