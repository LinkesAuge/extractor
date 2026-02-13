import { ipcMain, dialog } from 'electron';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import OcrProcessor from '../ocr-processor.js';
import { createOcrProvider } from '../ocr/provider-factory.js';
import { startLogSession } from '../services/gui-logger.js';
import { MEMBER_RESULTS_DIR, EVENT_RESULTS_DIR } from '../utils/paths.js';
import { localDate } from '../utils/date.js';
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

  // ─── CSV Export (unified) ──────────────────────────────────────────────────
  registerExportCsvHandler('export-csv', {
    resultsDir: MEMBER_RESULTS_DIR,
    defaultFileName: 'mitglieder.csv',
    toCsv: OcrProcessor.toCSV,
    logger,
  });

  registerExportCsvHandler('export-event-csv', {
    resultsDir: EVENT_RESULTS_DIR,
    defaultFileName: 'event.csv',
    toCsv: OcrProcessor.toEventCSV,
    logger,
  });

  // ─── Auto-Save CSV (unified) ──────────────────────────────────────────────
  registerAutoSaveHandler('auto-save-csv', {
    resultsDir: MEMBER_RESULTS_DIR,
    filePrefix: 'mitglieder',
    toCsv: OcrProcessor.toCSV,
    logger,
  });

  registerAutoSaveHandler('auto-save-event-csv', {
    resultsDir: EVENT_RESULTS_DIR,
    filePrefix: 'event',
    toCsv: OcrProcessor.toEventCSV,
    logger,
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
      const processor = createOcrProvider({ engine, logger, settings: ocrSettings || {} });
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

// ─── Auto-Save CSV (unified) ────────────────────────────────────────────────

function registerAutoSaveHandler(channel, config) {
  const { resultsDir, filePrefix, toCsv, logger } = config;

  ipcMain.handle(channel, async (_e, data) => {
    try {
      await mkdir(resultsDir, { recursive: true });
      const today = localDate();
      const fileName = `${filePrefix}_${today}.csv`;
      const filePath = join(resultsDir, fileName);
      const csv = toCsv(data);
      await writeFile(filePath, csv, 'utf-8');
      logger.success(`Auto-Save: ${filePath}`);
      return { ok: true, path: filePath, fileName };
    } catch (err) {
      logger.error(`Auto-Save fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}
