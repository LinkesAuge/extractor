import { ipcMain, shell } from 'electron';
import { join } from 'path';
import { homedir } from 'os';
import { access } from 'fs/promises';
import { getOllamaStatus } from '../services/ollama/ollama-detector.js';
import { installOllama } from '../services/ollama/ollama-installer.js';
import { startOllama, stopOllama } from '../services/ollama/ollama-process.js';
import { listModels, pullModel, deleteModel, generateWithImage } from '../services/ollama/ollama-api.js';
import { MODEL_REGISTRY, findModelById, getOllamaRef } from '../services/ollama/model-registry.js';
import appState from '../services/app-state.js';

/**
 * Resolve the Ollama models storage directory.
 * Respects the OLLAMA_MODELS env var; falls back to %HOMEPATH%\.ollama\models.
 * @returns {string}
 */
function getOllamaModelsDir() {
  return process.env.OLLAMA_MODELS || join(homedir(), '.ollama', 'models');
}

/**
 * Validate that modelId is a non-empty string matching a registered model.
 * @param {*} modelId
 * @returns {{ok: boolean, error?: string, model?: Object}}
 */
function validateModelId(modelId) {
  if (!modelId || typeof modelId !== 'string') {
    return { ok: false, error: 'Invalid model ID' };
  }
  const model = findModelById(modelId);
  if (!model) {
    return { ok: false, error: `Unknown model: ${modelId}` };
  }
  return { ok: true, model };
}

/**
 * Registers all Ollama-related IPC handlers.
 * @param {Object} logger - GUI logger instance.
 */
export function registerOllamaHandlers(logger) {
  // ─── Open Models Folder ────────────────────────────────────────────────
  ipcMain.handle('ollama-open-models-folder', async () => {
    const dir = getOllamaModelsDir();
    try {
      await access(dir);
      shell.openPath(dir);
      return { ok: true, path: dir };
    } catch {
      // Folder doesn't exist yet (no models downloaded) — open parent
      const parent = join(dir, '..');
      try {
        await access(parent);
        shell.openPath(parent);
        return { ok: true, path: parent };
      } catch {
        return { ok: false, error: 'Ollama directory not found.' };
      }
    }
  });

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
      logger.info(`Ollama models: ${models.map(m => m.name).join(', ') || '(none)'}`);
      return { ok: true, models };
    } catch (err) {
      return { ok: false, error: err.message, models: [] };
    }
  });

  // ─── Pull (Download) Model ─────────────────────────────────────────────
  ipcMain.handle('ollama-pull-model', async (_e, modelId) => {
    const v = validateModelId(modelId);
    if (!v.ok) return v;
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
    const v = validateModelId(modelId);
    if (!v.ok) return v;
    try {
      await deleteModel(v.model.ollamaRef);
      logger.info(`Modell "${modelId}" geloescht.`);
      return { ok: true };
    } catch (err) {
      logger.error(`Modell-Loeschung fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  // ─── Test Model ───────────────────────────────────────────────────────
  ipcMain.handle('ollama-test', async (_e, modelId) => {
    const v = validateModelId(modelId);
    if (!v.ok) return v;
    try {
      const ollamaRef = getOllamaRef(modelId);
      logger.info(`Test mit Modell "${modelId}" (${ollamaRef})...`);
      const response = await generateWithImage(
        ollamaRef,
        'Describe what you see in this image in one sentence.',
        [],
        { timeout: 30000 },
      );
      if (response && response.length > 0) {
        logger.success(`Test bestanden: "${response.substring(0, 100)}"`);
        return { ok: true, response: response.substring(0, 200) };
      }
      return { ok: false, error: 'Model returned empty response.' };
    } catch (err) {
      logger.error(`Modell-Test fehlgeschlagen: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });
}
