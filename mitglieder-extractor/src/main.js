import { app, BrowserWindow, nativeImage } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { APP_ICON } from './utils/paths.js';
import { createGuiLogger } from './services/gui-logger.js';
import appState from './services/app-state.js';
import { registerBrowserHandlers } from './ipc/browser-handler.js';
import { registerCaptureHandlers } from './ipc/capture-handler.js';
import { registerOcrHandlers } from './ipc/ocr-handler.js';
import { registerConfigHandlers } from './ipc/config-handler.js';
import { registerDialogHandlers } from './ipc/dialog-handler.js';
import { registerHistoryHandlers } from './ipc/history-handler.js';
import { registerValidationHandlers } from './ipc/validation-handler.js';
import { registerOllamaHandlers } from './ipc/ollama-handler.js';

// ─── Playwright browser path for packaged app ───────────────────────────────
// Must be set BEFORE importing playwright.
if (app.isPackaged) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(process.resourcesPath, 'pw-browsers');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── GUI Logger ──────────────────────────────────────────────────────────────

const guiLogger = createGuiLogger(() => appState.mainWindow);

// ─── Register all IPC handlers ──────────────────────────────────────────────

registerBrowserHandlers(guiLogger);
registerCaptureHandlers(guiLogger);
registerOcrHandlers(guiLogger);
registerConfigHandlers();
registerDialogHandlers(guiLogger);
registerHistoryHandlers(guiLogger);
registerValidationHandlers(guiLogger);
registerOllamaHandlers(guiLogger);

// ─── Electron Window ────────────────────────────────────────────────────────

function createWindow() {
  appState.mainWindow = new BrowserWindow({
    width: 1400,
    height: 960,
    minWidth: 900,
    minHeight: 700,
    title: 'Member Extractor',
    icon: nativeImage.createFromPath(APP_ICON).resize({ width: 256, height: 256 }),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  appState.mainWindow.loadFile(join(__dirname, 'renderer', 'index.html'));
  appState.mainWindow.setMenuBarVisibility(false);

  appState.mainWindow.on('closed', async () => {
    appState.mainWindow = null;
    if (appState.browserContext) {
      try { await appState.browserContext.close(); } catch { /* ignore */ }
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  if (appState.browserContext) {
    try { await appState.browserContext.close(); } catch { /* ignore */ }
  }
  // Stop Ollama if we started it
  try {
    const { stopOllama } = await import('./services/ollama/ollama-process.js');
    await stopOllama(guiLogger);
  } catch (err) {
    console.error('Failed to stop Ollama on quit:', err?.message || err);
  }
  app.quit();
});
