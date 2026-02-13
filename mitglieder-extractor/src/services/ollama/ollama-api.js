import { request } from 'http';

/** Default Ollama API base URL. */
const BASE_URL = 'http://127.0.0.1:11434';

/**
 * Low-level HTTP helper for Ollama REST API calls.
 * Uses Node's built-in http module (no external dependencies).
 *
 * @param {string} path - API path (e.g. '/api/tags').
 * @param {Object} [options]
 * @param {string} [options.method='GET'] - HTTP method.
 * @param {Object} [options.body] - JSON body (auto-serialized).
 * @param {number} [options.timeout=30000] - Request timeout in ms.
 * @returns {Promise<Object>} Parsed JSON response.
 */
export function ollamaRequest(path, { method = 'GET', body, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const req = request(url, {
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama request timed out')); });
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Check if Ollama is reachable and return version info.
 * @returns {Promise<{running: boolean, version?: string}>}
 */
export async function checkOllamaStatus() {
  try {
    const data = await ollamaRequest('/api/version', { timeout: 3000 });
    return { running: true, version: data.version || 'unknown' };
  } catch {
    return { running: false };
  }
}

/**
 * List all locally downloaded models.
 * @returns {Promise<Array<{name: string, size: number, modifiedAt: string}>>}
 */
export async function listModels() {
  const data = await ollamaRequest('/api/tags');
  return (data.models || []).map(m => ({
    name: m.name,
    size: m.size,
    modifiedAt: m.modified_at,
  }));
}

/**
 * Pull (download) a model with streaming progress.
 * @param {string} modelRef - Ollama model reference (e.g. 'glm-ocr' or 'hf.co/...').
 * @param {Function} [onProgress] - Callback: ({ status, completed, total }).
 * @returns {Promise<{ok: boolean}>}
 */
export function pullModel(modelRef, onProgress) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/pull', BASE_URL);
    const payload = JSON.stringify({ name: modelRef, stream: true });
    const req = request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            onProgress?.(event);
            if (event.status === 'success') {
              resolve({ ok: true });
            }
          } catch { /* ignore parse errors on partial lines */ }
        }
      });
      res.on('end', () => resolve({ ok: true }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Delete a locally downloaded model.
 * @param {string} modelRef - Model name to delete.
 * @returns {Promise<{ok: boolean}>}
 */
export async function deleteModel(modelRef) {
  await ollamaRequest('/api/delete', { method: 'DELETE', body: { name: modelRef } });
  return { ok: true };
}

/**
 * Run inference with an image (vision model).
 * @param {string} model - Model name.
 * @param {string} prompt - Text prompt.
 * @param {string[]} images - Array of base64-encoded images.
 * @param {Object} [options]
 * @param {number} [options.timeout=120000] - Request timeout in ms.
 * @returns {Promise<string>} Model response text.
 */
export function generateWithImage(model, prompt, images, { timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/generate', BASE_URL);
    const payload = JSON.stringify({ model, prompt, images, stream: false });
    const req = request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response || '');
        } catch {
          reject(new Error(`Invalid Ollama response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama inference timed out')); });
    req.write(payload);
    req.end();
  });
}
