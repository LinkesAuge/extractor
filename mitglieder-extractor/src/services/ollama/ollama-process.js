import { spawn } from 'child_process';
import { checkOllamaStatus } from './ollama-api.js';
import { detectOllamaBinary } from './ollama-detector.js';

/** Ollama background process reference. */
let ollamaProcess = null;

/** Whether we started Ollama (vs. it was already running). */
let weStartedOllama = false;

/**
 * Start Ollama as a background process (if not already running).
 * @param {Object} [logger] - Optional logger for status messages.
 * @returns {Promise<{ok: boolean, alreadyRunning?: boolean, error?: string}>}
 */
export async function startOllama(logger) {
  const status = await checkOllamaStatus();
  if (status.running) {
    logger?.info('Ollama is already running.');
    return { ok: true, alreadyRunning: true };
  }
  const binary = await detectOllamaBinary();
  if (!binary.installed) {
    return { ok: false, error: 'Ollama is not installed.' };
  }
  try {
    logger?.info(`Starting Ollama from: ${binary.path}`);
    ollamaProcess = spawn(binary.path, ['serve'], {
      stdio: 'ignore',
      detached: false,
      windowsHide: true,
    });
    ollamaProcess.on('error', (err) => {
      logger?.error(`Ollama process error: ${err.message}`);
      ollamaProcess = null;
      weStartedOllama = false;
    });
    ollamaProcess.on('exit', (code) => {
      logger?.info(`Ollama process exited with code ${code ?? 'unknown'}`);
      ollamaProcess = null;
      weStartedOllama = false;
    });
    weStartedOllama = true;
    // Wait for Ollama to become reachable
    const ready = await waitForOllama(10000);
    if (!ready) {
      // Cleanup: kill the process we started since it's not responding
      killOllamaProcess(logger);
      return { ok: false, error: 'Ollama started but did not become reachable within 10 seconds.' };
    }
    logger?.success('Ollama is running.');
    return { ok: true, alreadyRunning: false };
  } catch (err) {
    killOllamaProcess(logger);
    return { ok: false, error: err.message };
  }
}

/**
 * Stop the Ollama background process (only if we started it).
 * @param {Object} [logger] - Optional logger.
 * @returns {Promise<{ok: boolean}>}
 */
export async function stopOllama(logger) {
  if (!weStartedOllama || !ollamaProcess) {
    logger?.info('Ollama was not started by us, skipping shutdown.');
    return { ok: true };
  }
  killOllamaProcess(logger);
  return { ok: true };
}

/**
 * Check if Ollama is currently managed by us.
 * @returns {boolean}
 */
export function isOllamaManagedByUs() {
  return weStartedOllama && ollamaProcess !== null;
}

/**
 * Kill the Ollama process and reset state.
 * @param {Object} [logger]
 */
function killOllamaProcess(logger) {
  if (ollamaProcess) {
    try {
      // On Windows, process.kill with default signal works reliably
      ollamaProcess.kill();
      logger?.info('Ollama process stopped.');
    } catch (err) {
      logger?.error(`Failed to stop Ollama: ${err.message}`);
    }
  }
  ollamaProcess = null;
  weStartedOllama = false;
}

/**
 * Poll until Ollama API becomes reachable.
 * @param {number} timeoutMs - Maximum wait time.
 * @param {number} intervalMs - Poll interval.
 * @returns {Promise<boolean>}
 */
async function waitForOllama(timeoutMs = 10000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await checkOllamaStatus();
    if (status.running) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}
