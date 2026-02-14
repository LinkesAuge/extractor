import { access } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { checkOllamaStatus } from './ollama-api.js';

/**
 * Build a list of possible Ollama binary paths on Windows.
 * Skips paths where required env variables are empty/unset.
 * @returns {string[]}
 */
function getWindowsPaths() {
  const paths = [];
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  if (localAppData) {
    paths.push(join(localAppData, 'Programs', 'Ollama', 'ollama.exe'));
  }
  if (programFiles) {
    paths.push(join(programFiles, 'Ollama', 'ollama.exe'));
  }
  return paths;
}

/**
 * Try to find Ollama on the system PATH via `where` (Windows).
 * @returns {Promise<string|null>}
 */
async function findOnPath() {
  return new Promise((resolve) => {
    execFile('where', ['ollama'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      // `where` returns one path per line; take the first
      resolve(stdout.trim().split(/\r?\n/)[0]);
    });
  });
}

/**
 * Check if the Ollama binary exists on disk.
 * Checks common install paths, then falls back to PATH lookup.
 * @returns {Promise<{installed: boolean, path?: string}>}
 */
export async function detectOllamaBinary() {
  const knownPaths = getWindowsPaths();
  for (const binPath of knownPaths) {
    try {
      await access(binPath);
      return { installed: true, path: binPath };
    } catch { /* not found, try next */ }
  }
  // Fallback: check system PATH
  const pathResult = await findOnPath();
  if (pathResult) {
    return { installed: true, path: pathResult };
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
