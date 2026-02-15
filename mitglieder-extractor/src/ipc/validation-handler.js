import { ipcMain, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { parseNamesCsv, parseCorrectionsCsv } from '../ocr/csv-parser.js';
import { dt } from '../services/i18n-backend.js';
import appState from '../services/app-state.js';

const BOM = '\uFEFF';

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
      // Compare against player history for score/coords change detection
      const mode = options?.mode || 'member';
      if (mode === 'member') {
        appState.validationManager.compareWithHistory(validated, {
          scoreChangeThreshold: options?.scoreChangeThreshold,
        });
      }
      return { ok: true, members: validated };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('update-player-history', async (_e, members) => {
    try {
      const updated = appState.validationManager.updatePlayerHistory(members);
      await appState.validationManager.save();
      return { ok: true, updated };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ─── CSV Import/Export: Validation Names ───────────────────────────────────

  ipcMain.handle('import-validation-names-csv', async () => {
    try {
      const result = await dialog.showOpenDialog(appState.mainWindow, {
        title: dt('importNames'),
        filters: [
          { name: dt('csvFiles'), extensions: ['csv'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { ok: false };
      const raw = await readFile(result.filePaths[0], 'utf-8');
      const names = parseNamesCsv(raw);
      const added = appState.validationManager.importNames(names);
      await appState.validationManager.save();
      logger.success(`${added} neue Namen importiert aus ${result.filePaths[0]}`);
      return { ok: true, added, state: appState.validationManager.getState() };
    } catch (err) {
      logger.error(`Namen-Import fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('export-validation-names-csv', async () => {
    try {
      const state = appState.validationManager.getState();
      const header = 'Name';
      const rows = state.knownNames.map(n => `"${n.replace(/"/g, '""')}"`);
      const csv = BOM + [header, ...rows].join('\r\n');
      const result = await dialog.showSaveDialog(appState.mainWindow, {
        title: dt('exportNames'),
        defaultPath: 'bekannte-spieler.csv',
        filters: [
          { name: dt('csvFiles'), extensions: ['csv'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return { ok: false };
      await writeFile(result.filePath, csv, 'utf-8');
      logger.success(`${state.knownNames.length} Namen exportiert: ${result.filePath}`);
      return { ok: true, path: result.filePath };
    } catch (err) {
      logger.error(`Namen-Export fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  // ─── CSV Import/Export: Corrections ───────────────────────────────────────

  ipcMain.handle('import-corrections-csv', async () => {
    try {
      const result = await dialog.showOpenDialog(appState.mainWindow, {
        title: dt('importCorrections'),
        filters: [
          { name: dt('csvFiles'), extensions: ['csv'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { ok: false };
      const raw = await readFile(result.filePaths[0], 'utf-8');
      const pairs = parseCorrectionsCsv(raw);
      let added = 0;
      for (const { ocrName, correctName } of pairs) {
        appState.validationManager.addCorrection(ocrName, correctName);
        added++;
      }
      await appState.validationManager.save();
      logger.success(`${added} Korrekturen importiert aus ${result.filePaths[0]}`);
      return { ok: true, added, state: appState.validationManager.getState() };
    } catch (err) {
      logger.error(`Korrekturen-Import fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('export-corrections-csv', async () => {
    try {
      const state = appState.validationManager.getState();
      const header = 'OCR-Name,Korrekter Name';
      const entries = Object.entries(state.corrections);
      const rows = entries.map(([ocr, correct]) =>
        `"${ocr.replace(/"/g, '""')}","${correct.replace(/"/g, '""')}"`
      );
      const csv = BOM + [header, ...rows].join('\r\n');
      const result = await dialog.showSaveDialog(appState.mainWindow, {
        title: dt('exportCorrections'),
        defaultPath: 'korrekturen.csv',
        filters: [
          { name: dt('csvFiles'), extensions: ['csv'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return { ok: false };
      await writeFile(result.filePath, csv, 'utf-8');
      logger.success(`${entries.length} Korrekturen exportiert: ${result.filePath}`);
      return { ok: true, path: result.filePath };
    } catch (err) {
      logger.error(`Korrekturen-Export fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}
