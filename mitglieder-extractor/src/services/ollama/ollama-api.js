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
      if (res.statusCode && res.statusCode >= 400) {
        let errData = '';
        res.on('data', chunk => { errData += chunk; });
        res.on('end', () => reject(new Error(`Ollama HTTP ${res.statusCode}: ${errData.substring(0, 200)}`)));
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from Ollama: ${data.substring(0, 200)}`));
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
 * @param {number} [timeout=600000] - Overall timeout in ms (default 10min for large models).
 * @returns {Promise<{ok: boolean}>}
 */
export function pullModel(modelRef, onProgress, timeout = 600000) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/pull', BASE_URL);
    const payload = JSON.stringify({ model: modelRef, stream: true });
    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };
    const timer = setTimeout(() => {
      req.destroy();
      settle(reject, new Error('Model pull timed out'));
    }, timeout);
    const req = request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errData = '';
        res.on('data', chunk => { errData += chunk; });
        res.on('end', () => { clearTimeout(timer); settle(reject, new Error(`Pull failed: HTTP ${res.statusCode}: ${errData.substring(0, 200)}`)); });
        return;
      }
      let buffer = '';
      let gotSuccess = false;
      let streamError = null;
      res.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            // Ollama sends { error: "..." } on failure
            if (event.error) {
              streamError = event.error;
              clearTimeout(timer);
              settle(reject, new Error(`Pull failed: ${event.error}`));
              return;
            }
            onProgress?.(event);
            if (event.status === 'success') {
              gotSuccess = true;
              clearTimeout(timer);
              settle(resolve, { ok: true });
            }
          } catch { /* ignore partial JSON */ }
        }
      });
      res.on('end', () => {
        clearTimeout(timer);
        // Flush remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            if (event.error) {
              settle(reject, new Error(`Pull failed: ${event.error}`));
              return;
            }
            onProgress?.(event);
            if (event.status === 'success') {
              settle(resolve, { ok: true });
              return;
            }
          } catch { /* ignore */ }
        }
        // Only resolve if we actually got a success event
        if (gotSuccess) {
          settle(resolve, { ok: true });
        } else if (!streamError) {
          settle(reject, new Error('Pull ended without success confirmation. The model may not be available.'));
        }
      });
    });
    req.on('error', (err) => { clearTimeout(timer); settle(reject, err); });
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
  await ollamaRequest('/api/delete', { method: 'DELETE', body: { model: modelRef } });
  return { ok: true };
}

/**
 * Run inference with an image (vision model).
 * @param {string} model - Model name.
 * @param {string} prompt - Text prompt.
 * @param {string[]} images - Array of base64-encoded images.
 * @param {Object} [options]
 * @param {number} [options.timeout=120000] - Request timeout in ms.
 * @param {number} [options.numPredict=2048] - Max output tokens (prevents runaway generation).
 * @param {number} [options.temperature=0] - Sampling temperature (0 = deterministic).
 * @returns {Promise<string>} Model response text.
 */
export function generateWithImage(model, prompt, images, { timeout = 120000, numPredict = 2048, temperature = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/generate', BASE_URL);
    const payload = JSON.stringify({
      model,
      prompt,
      images,
      stream: false,
      options: {
        num_predict: numPredict,
        temperature,
      },
    });
    const req = request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errData = '';
        res.on('data', chunk => { errData += chunk; });
        res.on('end', () => {
          const detail = errData.substring(0, 200).trim();
          reject(new Error(`Ollama inference failed: HTTP ${res.statusCode}${detail ? ` — ${detail}` : ''}`));
        });
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response || '');
        } catch {
          reject(new Error('Invalid JSON response from Ollama inference.'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama inference timed out')); });
    req.write(payload);
    req.end();
  });
}
