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
  openScreenshot: (path) => ipcRenderer.invoke('open-screenshot', path),
  openResultsDir: () => ipcRenderer.invoke('open-results-dir'),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder'),
  browseFolder: (options) => ipcRenderer.invoke('browse-folder', options),
  browseCaptureFolder: (defaultPath) => ipcRenderer.invoke('browse-capture-folder', defaultPath),
  deleteFolder: (path) => ipcRenderer.invoke('delete-folder', path),

  // OCR Auswertung
  startOcr: (folderPath, settings) => ipcRenderer.invoke('start-ocr', folderPath, settings),
  stopOcr: () => ipcRenderer.invoke('stop-ocr'),
  exportCsv: (members, defaultName) => ipcRenderer.invoke('export-csv', members, defaultName),
  autoSaveCsv: (members) => ipcRenderer.invoke('auto-save-csv', members),

  // Event Region
  selectEventRegion: () => ipcRenderer.invoke('select-event-region'),
  previewEventRegion: (region) => ipcRenderer.invoke('preview-event-region', region),

  // Event Kalibrierung
  testEventScroll: (options) => ipcRenderer.invoke('test-event-scroll', options),

  // Event Capture
  startEventCapture: (options) => ipcRenderer.invoke('start-event-capture', options),
  stopEventCapture: () => ipcRenderer.invoke('stop-event-capture'),

  // Event OCR Auswertung
  startEventOcr: (folderPath, settings) => ipcRenderer.invoke('start-event-ocr', folderPath, settings),
  stopEventOcr: () => ipcRenderer.invoke('stop-event-ocr'),
  exportEventCsv: (entries, defaultName) => ipcRenderer.invoke('export-event-csv', entries, defaultName),
  autoSaveEventCsv: (entries) => ipcRenderer.invoke('auto-save-event-csv', entries),

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
  validateOcrResults: (members, options) => ipcRenderer.invoke('validate-ocr-results', members, options),
  importValidationList: () => ipcRenderer.invoke('import-validation-list'),
  exportValidationList: () => ipcRenderer.invoke('export-validation-list'),

  // Ollama / Vision Model
  ollamaStatus: () => ipcRenderer.invoke('ollama-status'),
  ollamaInstall: () => ipcRenderer.invoke('ollama-install'),
  ollamaStart: () => ipcRenderer.invoke('ollama-start'),
  ollamaStop: () => ipcRenderer.invoke('ollama-stop'),
  ollamaModelRegistry: () => ipcRenderer.invoke('ollama-model-registry'),
  ollamaListModels: () => ipcRenderer.invoke('ollama-list-models'),
  ollamaPullModel: (modelId) => ipcRenderer.invoke('ollama-pull-model', modelId),
  ollamaDeleteModel: (modelId) => ipcRenderer.invoke('ollama-delete-model', modelId),
  ollamaTest: (modelId) => ipcRenderer.invoke('ollama-test', modelId),
  ollamaOpenModelsFolder: () => ipcRenderer.invoke('ollama-open-models-folder'),

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
  // Event-spezifische Events
  onEventCaptureProgress: (callback) => {
    ipcRenderer.on('event-capture-progress', (_e, data) => callback(data));
  },
  onEventCaptureDone: (callback) => {
    ipcRenderer.on('event-capture-done', (_e, data) => callback(data));
  },
  onEventOcrProgress: (callback) => {
    ipcRenderer.on('event-ocr-progress', (_e, data) => callback(data));
  },
  onEventOcrDone: (callback) => {
    ipcRenderer.on('event-ocr-done', (_e, data) => callback(data));
  },
  onLog: (callback) => {
    ipcRenderer.on('log', (_e, data) => callback(data));
  },
  // Ollama Events
  onOllamaInstallProgress: (callback) => {
    ipcRenderer.on('ollama-install-progress', (_e, data) => callback(data));
  },
  onOllamaPullProgress: (callback) => {
    ipcRenderer.on('ollama-pull-progress', (_e, data) => callback(data));
  },
});
