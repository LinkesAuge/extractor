import { ipcMain, shell, dialog } from 'electron';
import { mkdir, rm, stat } from 'fs/promises';
import { resolve, dirname, normalize } from 'path';
import {
  APP_DATA_DIR, LOGS_DIR, RESULTS_DIR,
  DEFAULT_MEMBER_CAPTURES_DIR, DEFAULT_EVENT_CAPTURES_DIR,
} from '../utils/paths.js';
import { dt } from '../services/i18n-backend.js';
import appState from '../services/app-state.js';

/** Directories that shell-open and delete operations are allowed to target. */
const ALLOWED_ROOTS = [
  resolve(APP_DATA_DIR),
  resolve(DEFAULT_MEMBER_CAPTURES_DIR),
  resolve(DEFAULT_EVENT_CAPTURES_DIR),
];

/**
 * Asserts that the given absolute path is inside one of the allowed root directories.
 * @param {string} absPath - Resolved absolute path (from path.resolve()).
 * @throws {Error} if the path is outside all allowed roots.
 */
function assertPathAllowed(absPath) {
  const norm = resolve(absPath);
  const allowed = ALLOWED_ROOTS.some(root => norm.startsWith(root));
  if (!allowed) {
    throw new Error(`Zugriff verweigert: Pfad liegt ausserhalb erlaubter Verzeichnisse.`);
  }
}

/**
 * Registers dialog and folder-related IPC handlers.
 * @param {Object} logger - GUI logger instance.
 */
export function registerDialogHandlers(logger) {
  ipcMain.handle('open-folder', async (_e, folderPath) => {
    try {
      const absPath = resolve(folderPath);
      assertPathAllowed(absPath);
      const errMsg = await shell.openPath(absPath);
      if (errMsg) return { ok: false, error: errMsg };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('open-screenshot', async (_e, filePath) => {
    try {
      const absPath = resolve(filePath);
      assertPathAllowed(absPath);
      const errMsg = await shell.openPath(absPath);
      if (errMsg) return { ok: false, error: errMsg };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('open-log-folder', async () => {
    await mkdir(LOGS_DIR, { recursive: true });
    shell.openPath(LOGS_DIR);
    return { ok: true };
  });

  ipcMain.handle('open-results-dir', async () => {
    await mkdir(RESULTS_DIR, { recursive: true });
    shell.openPath(RESULTS_DIR);
    return { ok: true };
  });

  ipcMain.handle('browse-folder', async (_e, options) => {
    const dialogOpts = {
      properties: ['openDirectory', 'createDirectory'],
      title: options?.title || dt('browseFolder'),
    };
    if (options?.defaultPath) {
      dialogOpts.defaultPath = resolve(options.defaultPath);
    }
    const result = await dialog.showOpenDialog(appState.mainWindow, dialogOpts);
    if (result.canceled || !result.filePaths.length) return { ok: false };
    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle('browse-capture-folder', async (_e, defaultPath) => {
    const dialogOpts = {
      title: dt('browseCapture'),
      properties: ['openFile', 'openDirectory'],
      filters: [
        { name: dt('screenshots'), extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] },
        { name: dt('allFiles'), extensions: ['*'] },
      ],
    };
    if (defaultPath) {
      dialogOpts.defaultPath = resolve(defaultPath);
    }
    const result = await dialog.showOpenDialog(appState.mainWindow, dialogOpts);
    if (result.canceled || !result.filePaths.length) return { ok: false };
    const selected = result.filePaths[0];
    try {
      const s = await stat(selected);
      return { ok: true, path: s.isDirectory() ? selected : dirname(selected) };
    } catch (err) {
      logger.info(`Stat fehlgeschlagen fuer ${selected}: ${err.message}`);
      return { ok: true, path: selected };
    }
  });

  ipcMain.handle('delete-folder', async (_e, folderPath) => {
    try {
      const absPath = resolve(folderPath);
      assertPathAllowed(absPath);
      await rm(absPath, { recursive: true, force: true });
      logger.success(`Ordner geloescht: ${absPath}`);
      return { ok: true };
    } catch (err) {
      logger.error(`Ordner loeschen fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}
