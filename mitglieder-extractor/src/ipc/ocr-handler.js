import { ipcMain, dialog } from 'electron';
import { writeFile, readFile, mkdir, copyFile, rm } from 'fs/promises';
import { join, resolve, basename } from 'path';
import { tmpdir } from 'os';
import { toMemberCSV, toEventCSV } from '../ocr/csv-formatter.js';
import { parseMemberCSV } from '../ocr/csv-parser.js';
import { createOcrProvider } from '../ocr/provider-factory.js';
import { startLogSession } from '../services/gui-logger.js';
import { MEMBER_RESULTS_DIR, EVENT_RESULTS_DIR } from '../utils/paths.js';
import { dt } from '../services/i18n-backend.js';
import appState from '../services/app-state.js';

/**
 * Registers all OCR-related IPC handlers.
 * Uses a unified approach for both member and event OCR.
 * @param {Object} logger - GUI logger instance.
 */
export function registerOcrHandlers(logger) {
  // ─── Member OCR ────────────────────────────────────────────────────────────
  registerStartOcrHandler('start-ocr', {
    processorKey: 'ocrProcessor',
    logPrefix: 'member-ocr',
    progressChannel: 'ocr-progress',
    doneChannel: 'ocr-done',
    mode: 'member',
    logger,
  });

  ipcMain.handle('stop-ocr', async () => {
    if (appState.ocrProcessor) {
      appState.ocrProcessor.abort();
      appState.ocrProcessor = null;
    }
    return { ok: true };
  });

  // ─── Event OCR ─────────────────────────────────────────────────────────────
  registerStartOcrHandler('start-event-ocr', {
    processorKey: 'eventOcrProcessor',
    logPrefix: 'event-ocr',
    progressChannel: 'event-ocr-progress',
    doneChannel: 'event-ocr-done',
    mode: 'event',
    logger,
  });

  ipcMain.handle('stop-event-ocr', async () => {
    if (appState.eventOcrProcessor) {
      appState.eventOcrProcessor.abort();
      appState.eventOcrProcessor = null;
    }
    return { ok: true };
  });

  // ─── Partial OCR (re-run selected files) ───────────────────────────────────
  ipcMain.handle('start-partial-ocr', async (_e, filePaths, ocrSettings) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { ok: false, error: 'Keine Dateien angegeben.' };
    }
    if (appState.ocrProcessor) {
      return { ok: false, error: 'OCR laeuft bereits. Bitte warten oder abbrechen.' };
    }
    const tempDir = join(tmpdir(), `partial-ocr-${Date.now()}`);
    try {
      await startLogSession('partial-ocr');
      await mkdir(tempDir, { recursive: true });
      // Copy files into temp directory to reuse processFolder
      for (const fp of filePaths) {
        const absPath = resolve(fp);
        await copyFile(absPath, join(tempDir, basename(absPath)));
      }
      logger.info(`Partial-OCR: ${filePaths.length} Datei(en) in ${tempDir}`);
      const engine = ocrSettings?.engine || 'tesseract';
      let validationContext = null;
      try {
        const vm = appState.validationManager;
        if (vm && vm.knownNames?.length > 0) {
          validationContext = vm.getState();
        }
      } catch { /* optional */ }
      const processor = createOcrProvider({ engine, logger, settings: ocrSettings || {}, validationContext });
      appState.ocrProcessor = processor;
      const onProgress = (progress) => {
        appState.mainWindow?.webContents.send('ocr-progress', {
          current: progress.current,
          total: progress.total,
          file: progress.file,
        });
      };
      const members = await processor.processFolder(tempDir, onProgress);
      appState.ocrProcessor = null;
      logger.success(`Partial-OCR abgeschlossen: ${members.length} Mitglieder.`);
      return { ok: true, members };
    } catch (err) {
      logger.error(`Partial-OCR-Fehler: ${err.message}`);
      appState.ocrProcessor = null;
      return { ok: false, error: err.message };
    } finally {
      try { await rm(tempDir, { recursive: true, force: true }); } catch { /* cleanup best-effort */ }
    }
  });

  // ─── CSV Export (unified) ──────────────────────────────────────────────────
  registerExportCsvHandler('export-csv', {
    resultsDir: MEMBER_RESULTS_DIR,
    defaultFileName: 'mitglieder.csv',
    toCsv: toMemberCSV,
    logger,
  });

  registerExportCsvHandler('export-event-csv', {
    resultsDir: EVENT_RESULTS_DIR,
    defaultFileName: 'event.csv',
    toCsv: toEventCSV,
    logger,
  });

  // ─── CSV Import (OCR results) ─────────────────────────────────────────────
  ipcMain.handle('import-ocr-csv', async () => {
    try {
      const result = await dialog.showOpenDialog(appState.mainWindow, {
        title: dt('importOcrCsv'),
        filters: [
          { name: dt('csvFiles'), extensions: ['csv'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { ok: false };
      const raw = await readFile(result.filePaths[0], 'utf-8');
      const members = parseMemberCSV(raw);
      logger.success(`CSV importiert: ${members.length} Eintraege aus ${result.filePaths[0]}`);
      return { ok: true, members, path: result.filePaths[0] };
    } catch (err) {
      logger.error(`CSV-Import fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}

// ─── Start OCR (unified) ─────────────────────────────────────────────────────

function registerStartOcrHandler(channel, config) {
  const { processorKey, logPrefix, progressChannel, doneChannel, mode, logger } = config;

  ipcMain.handle(channel, async (_e, folderPath, ocrSettings) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return { ok: false, error: 'Kein Ordnerpfad angegeben.' };
    }
    // Guard against concurrent OCR runs for the same mode
    if (appState[processorKey]) {
      return { ok: false, error: 'OCR laeuft bereits. Bitte warten oder abbrechen.' };
    }
    try {
      await startLogSession(logPrefix);
      const absPath = resolve(folderPath);
      logger.info(`Starte ${mode === 'event' ? 'Event-' : ''}OCR-Auswertung: ${absPath}`);

      const engine = ocrSettings?.engine || 'tesseract';
      // Load validation context (corrections + known names) for runtime name correction.
      // Graceful fallback: if validationManager hasn't been loaded, skip corrections.
      let validationContext = null;
      try {
        const vm = appState.validationManager;
        if (vm && vm.knownNames?.length > 0) {
          validationContext = vm.getState();
          logger.info(`Runtime-Korrektur aktiv: ${validationContext.knownNames.length} bekannte Namen, ${Object.keys(validationContext.corrections).length} Korrekturen.`);
        }
      } catch { /* validation context is optional */ }
      const processor = createOcrProvider({ engine, logger, settings: ocrSettings || {}, validationContext });
      appState[processorKey] = processor;

      const onProgress = (progress) => {
        appState.mainWindow?.webContents.send(progressChannel, {
          current: progress.current,
          total: progress.total,
          file: progress.file,
        });
      };

      const resultKey = mode === 'event' ? 'entries' : 'members';
      const processMethod = mode === 'event' ? 'processEventFolder' : 'processFolder';
      const results = await processor[processMethod](absPath, onProgress);

      appState.mainWindow?.webContents.send(doneChannel, { [resultKey]: results });
      appState[processorKey] = null;

      return { ok: true, [resultKey]: results };
    } catch (err) {
      logger.error(`${mode === 'event' ? 'Event-' : ''}OCR-Fehler: ${err.message}`);
      appState[processorKey] = null;
      return { ok: false, error: err.message };
    }
  });
}

// ─── CSV Export (unified) ────────────────────────────────────────────────────

function registerExportCsvHandler(channel, config) {
  const { resultsDir, defaultFileName, toCsv, logger } = config;

  ipcMain.handle(channel, async (_e, data, defaultName) => {
    try {
      await mkdir(resultsDir, { recursive: true });
      const result = await dialog.showSaveDialog(appState.mainWindow, {
        title: dt('exportCsv'),
        defaultPath: join(resultsDir, defaultName || defaultFileName),
        filters: [
          { name: dt('csvFiles'), extensions: ['csv'] },
          { name: dt('allFiles'), extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return { ok: false };
      const csv = toCsv(data);
      await writeFile(result.filePath, csv, 'utf-8');
      logger.success(`CSV exportiert: ${result.filePath}`);
      return { ok: true, path: result.filePath };
    } catch (err) {
      logger.error(`CSV-Export fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}

