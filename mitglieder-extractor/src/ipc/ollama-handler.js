import { ipcMain } from 'electron';
import { getOllamaStatus } from '../services/ollama/ollama-detector.js';
import { installOllama } from '../services/ollama/ollama-installer.js';
import { startOllama, stopOllama } from '../services/ollama/ollama-process.js';
import { listModels, pullModel, deleteModel } from '../services/ollama/ollama-api.js';
import { MODEL_REGISTRY, findModelById, getOllamaRef } from '../services/ollama/model-registry.js';
import appState from '../services/app-state.js';

/**
 * Registers all Ollama-related IPC handlers.
 * @param {Object} logger - GUI logger instance.
 */
export function registerOllamaHandlers(logger) {
  // ─── Status ─────────────────────────────────────────────────────────────
  ipcMain.handle('ollama-status', async () => {
    try {
      return { ok: true, ...(await getOllamaStatus()) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ─── Install ────────────────────────────────────────────────────────────
  ipcMain.handle('ollama-install', async () => {
    try {
      logger.info('Ollama-Installation gestartet...');
      const result = await installOllama((progress) => {
        appState.mainWindow?.webContents.send('ollama-install-progress', progress);
      });
      if (result.ok) {
        logger.success('Ollama erfolgreich installiert.');
      } else {
        logger.error(`Ollama-Installation fehlgeschlagen: ${result.error}`);
      }
      return result;
    } catch (err) {
      logger.error(`Ollama-Installation Fehler: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  // ─── Start / Stop ──────────────────────────────────────────────────────
  ipcMain.handle('ollama-start', async () => {
    try {
      return await startOllama(logger);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('ollama-stop', async () => {
    try {
      return await stopOllama(logger);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ─── Model Registry ────────────────────────────────────────────────────
  ipcMain.handle('ollama-model-registry', () => {
    return { ok: true, models: MODEL_REGISTRY };
  });

  // ─── List Downloaded Models ─────────────────────────────────────────────
  ipcMain.handle('ollama-list-models', async () => {
    try {
      const models = await listModels();
      return { ok: true, models };
    } catch (err) {
      return { ok: false, error: err.message, models: [] };
    }
  });

  // ─── Pull (Download) Model ─────────────────────────────────────────────
  ipcMain.handle('ollama-pull-model', async (_e, modelId) => {
    try {
      const ollamaRef = getOllamaRef(modelId);
      logger.info(`Modell "${modelId}" wird heruntergeladen (${ollamaRef})...`);
      const result = await pullModel(ollamaRef, (event) => {
        appState.mainWindow?.webContents.send('ollama-pull-progress', {
          modelId,
          ...event,
        });
      });
      logger.success(`Modell "${modelId}" erfolgreich heruntergeladen.`);
      return result;
    } catch (err) {
      logger.error(`Modell-Download fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  // ─── Delete Model ──────────────────────────────────────────────────────
  ipcMain.handle('ollama-delete-model', async (_e, modelId) => {
    try {
      const model = findModelById(modelId);
      if (!model) return { ok: false, error: `Unbekanntes Modell: ${modelId}` };
      await deleteModel(model.ollamaRef);
      logger.info(`Modell "${modelId}" geloescht.`);
      return { ok: true };
    } catch (err) {
      logger.error(`Modell-Loeschung fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}
