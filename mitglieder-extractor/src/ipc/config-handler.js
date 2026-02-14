import { ipcMain } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { CONFIG_FILE } from '../utils/paths.js';
import { setLanguage } from '../services/i18n-backend.js';
import { parseConfig } from '../utils/config-schema.js';

/**
 * Registers config-related IPC handlers (load and save).
 */
export function registerConfigHandlers() {
  ipcMain.handle('load-config', async () => {
    try {
      const data = await readFile(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed === null || typeof parsed !== 'object') {
        return { ok: true, config: null };
      }
      const config = parseConfig(parsed);
      if (config.language === 'de' || config.language === 'en') {
        setLanguage(config.language);
      }
      return { ok: true, config };
    } catch (err) {
      // ENOENT = no config yet (fresh install) — not an error
      if (err.code === 'ENOENT') return { ok: true, config: null };
      const message = err.issues ? err.issues.map((i) => i.message).join('; ') : err.message;
      return { ok: false, config: null, error: message };
    }
  });

  ipcMain.handle('save-config', async (_e, config) => {
    if (!config || typeof config !== 'object') {
      return { ok: false, error: 'Ungueltige Konfiguration.' };
    }
    try {
      const validated = parseConfig(config);
      if (validated.language === 'de' || validated.language === 'en') {
        setLanguage(validated.language);
      }
      await writeFile(CONFIG_FILE, JSON.stringify(validated, null, 2));
      return { ok: true };
    } catch (err) {
      const message = err.issues ? err.issues.map((i) => i.message).join('; ') : err.message;
      return { ok: false, error: message };
    }
  });
}
