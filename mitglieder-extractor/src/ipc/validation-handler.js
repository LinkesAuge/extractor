import { ipcMain, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { dt } from '../services/i18n-backend.js';
import appState from '../services/app-state.js';

/**
 * Registers all validation-related IPC handlers.
 * @param {Object} logger - GUI logger instance.
 */
export function registerValidationHandlers(logger) {
  ipcMain.handle('load-validation-list', async () => {
    try {
      await appState.validationManager.load();
      return { ok: true, ...appState.validationManager.getState() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('save-validation-list', async () => {
    try {
      await appState.validationManager.save();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('add-validation-name', async (_e, name) => {
    if (name == null || typeof name !== 'string') {
      return { ok: false, error: 'Ungueltiger Name.', added: false, state: appState.validationManager.getState() };
    }
    try {
      const added = appState.validationManager.addName(name);
      if (added) await appState.validationManager.save();
      return { ok: true, added, state: appState.validationManager.getState() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('remove-validation-name', async (_e, name) => {
    if (name == null || typeof name !== 'string') {
      return { ok: false, error: 'Ungueltiger Name.', removed: false, state: appState.validationManager.getState() };
    }
    try {
      const removed = appState.validationManager.removeName(name);
      if (removed) await appState.validationManager.save();
      return { ok: true, removed, state: appState.validationManager.getState() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('add-correction', async (_e, ocrName, correctName) => {
    if (!ocrName || typeof ocrName !== 'string' || !correctName || typeof correctName !== 'string') {
      return { ok: false, error: 'OCR-Name und korrekter Name sind erforderlich.' };
    }
    try {
      appState.validationManager.addCorrection(ocrName, correctName);
      await appState.validationManager.save();
      return { ok: true, state: appState.validationManager.getState() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('remove-correction', async (_e, ocrName) => {
    if (!ocrName || typeof ocrName !== 'string') {
      return { ok: false, error: 'OCR-Name ist erforderlich.' };
    }
    try {
      appState.validationManager.removeCorrection(ocrName);
      await appState.validationManager.save();
      return { ok: true, state: appState.validationManager.getState() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('validate-ocr-results', async (_e, members, options) => {
    try {
      await appState.validationManager.load();
      const validated = appState.validationManager.validateMembers(members, options || {});
      return { ok: true, members: validated };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('import-validation-list', async () => {
    try {
      const result = await dialog.showOpenDialog(appState.mainWindow, {
        title: dt('importValidation'),
        filters: [
          { name: dt('jsonFiles'), extensions: ['json'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { ok: false };
      const data = await readFile(result.filePaths[0], 'utf-8');
      const parsed = JSON.parse(data);
      let added = 0;
      if (Array.isArray(parsed.members || parsed)) {
        const arr = parsed.members || parsed;
        const names = arr.map(m => typeof m === 'string' ? m : m.name).filter(Boolean);
        added = appState.validationManager.importNames(names);
      } else if (parsed.knownNames) {
        added = appState.validationManager.importNames(parsed.knownNames);
        if (parsed.corrections) {
          for (const [key, val] of Object.entries(parsed.corrections)) {
            appState.validationManager.addCorrection(key, val);
          }
        }
      }
      await appState.validationManager.save();
      logger.success(`${added} neue Namen importiert.`);
      return { ok: true, added, state: appState.validationManager.getState() };
    } catch (err) {
      logger.error(`Import fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('export-validation-list', async () => {
    try {
      const result = await dialog.showSaveDialog(appState.mainWindow, {
        title: dt('exportValidation'),
        defaultPath: 'validation-list.json',
        filters: [
          { name: dt('jsonFiles'), extensions: ['json'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return { ok: false };
      const data = appState.validationManager.exportData();
      await writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.success(`Validierungsliste exportiert: ${result.filePath}`);
      return { ok: true, path: result.filePath };
    } catch (err) {
      logger.error(`Export fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}
