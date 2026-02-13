import { access } from 'fs/promises';
import { join } from 'path';
import { checkOllamaStatus } from './ollama-api.js';

/** Common Ollama install paths on Windows. */
const WINDOWS_PATHS = [
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
  join(process.env.PROGRAMFILES || '', 'Ollama', 'ollama.exe'),
  join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
];

/**
 * Check if the Ollama binary exists on disk.
 * @returns {Promise<{installed: boolean, path?: string}>}
 */
export async function detectOllamaBinary() {
  for (const binPath of WINDOWS_PATHS) {
    try {
      await access(binPath);
      return { installed: true, path: binPath };
    } catch { /* not found, try next */ }
  }
  return { installed: false };
}

/**
 * Full Ollama status check: binary existence + API reachability.
 * @returns {Promise<{installed: boolean, running: boolean, version?: string, path?: string}>}
 */
export async function getOllamaStatus() {
  const [binary, api] = await Promise.all([
    detectOllamaBinary(),
    checkOllamaStatus(),
  ]);
  return {
    installed: binary.installed,
    running: api.running,
    version: api.version,
    path: binary.path,
  };
}
