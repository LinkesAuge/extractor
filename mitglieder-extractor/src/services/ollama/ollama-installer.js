import { createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { get } from 'https';
import { execFile } from 'child_process';
import { app } from 'electron';

/** Ollama download URL for Windows. */
const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download/OllamaSetup.exe';

/**
 * Download a file from a URL with progress reporting.
 * Follows redirects (up to 5 hops).
 *
 * @param {string} url - Download URL.
 * @param {string} destPath - Local destination file path.
 * @param {Function} [onProgress] - Callback: ({ downloadedMB, totalMB, percent }).
 * @param {number} [maxRedirects=5] - Maximum redirect hops.
 * @returns {Promise<string>} Path to downloaded file.
 */
export function downloadFile(url, destPath, onProgress, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl, redirectsLeft) => {
      get(reqUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
          const nextUrl = res.headers.location;
          if (!nextUrl.startsWith('https://')) {
            return reject(new Error('Redirect to non-HTTPS URL rejected for security'));
          }
          return doRequest(nextUrl, redirectsLeft - 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        const file = createWriteStream(destPath);
        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            onProgress?.({
              downloadedMB: (downloadedBytes / 1048576).toFixed(1),
              totalMB: (totalBytes / 1048576).toFixed(1),
              percent: Math.round((downloadedBytes / totalBytes) * 100),
            });
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(destPath); });
        file.on('error', (err) => { file.close(); reject(err); });
      }).on('error', reject);
    };
    doRequest(url, maxRedirects);
  });
}

/**
 * Download and install Ollama on Windows.
 * Downloads the installer to a temp directory, runs it silently, then cleans up.
 *
 * @param {Function} [onProgress] - Download progress callback.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function installOllama(onProgress) {
  const tempDir = join(app.getPath('temp'), 'member-extractor');
  await mkdir(tempDir, { recursive: true });
  const installerPath = join(tempDir, 'OllamaSetup.exe');
  try {
    onProgress?.({ status: 'downloading', percent: 0 });
    await downloadFile(OLLAMA_DOWNLOAD_URL, installerPath, onProgress);
    onProgress?.({ status: 'installing', percent: 100 });
    await runInstaller(installerPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    try { await unlink(installerPath); } catch { /* cleanup best-effort */ }
  }
}

/**
 * Run the Ollama installer silently.
 * @param {string} installerPath - Path to the downloaded installer.
 * @returns {Promise<void>}
 */
function runInstaller(installerPath) {
  return new Promise((resolve, reject) => {
    const child = execFile(installerPath, ['/S'], { timeout: 120000 }, (err) => {
      if (err) reject(new Error(`Installer failed: ${err.message}`));
      else resolve();
    });
    child.on('error', reject);
  });
}
