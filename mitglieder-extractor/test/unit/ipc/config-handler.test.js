import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock chain ─────────────────────────────────────────────────────────────

const handlers = new Map();
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch, fn) => handlers.set(ch, fn)) },
  app: { isPackaged: false, getPath: () => '/mock' },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/paths.js', () => ({
  CONFIG_FILE: '/mock/config.json',
}));

vi.mock('../../../src/services/i18n-backend.js', () => ({
  setLanguage: vi.fn(),
  dt: vi.fn(k => k),
}));

const { readFile, writeFile } = await import('fs/promises');
const { setLanguage } = await import('../../../src/services/i18n-backend.js');
const { registerConfigHandlers } = await import('../../../src/ipc/config-handler.js');

describe('config-handler', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerConfigHandlers();
  });

  describe('load-config', () => {
    it('registers the handler', () => {
      expect(handlers.has('load-config')).toBe(true);
    });

    it('loads and returns config JSON', async () => {
      const config = { language: 'de', browserUrl: 'http://test' };
      readFile.mockResolvedValueOnce(JSON.stringify(config));
      const result = await handlers.get('load-config')({});
      expect(result.ok).toBe(true);
      expect(result.config.language).toBe('de');
    });

    it('sets backend language when config has language', async () => {
      readFile.mockResolvedValueOnce(JSON.stringify({ language: 'en' }));
      await handlers.get('load-config')({});
      expect(setLanguage).toHaveBeenCalledWith('en');
    });

    it('returns null config when file does not exist', async () => {
      const enoent = new Error('ENOENT: no such file or directory');
      enoent.code = 'ENOENT';
      readFile.mockRejectedValueOnce(enoent);
      const result = await handlers.get('load-config')({});
      expect(result.ok).toBe(true);
      expect(result.config).toBeNull();
    });
  });

  describe('save-config', () => {
    it('registers the handler', () => {
      expect(handlers.has('save-config')).toBe(true);
    });

    it('writes config to disk', async () => {
      const config = { language: 'de' };
      const result = await handlers.get('save-config')({}, config);
      expect(result.ok).toBe(true);
      expect(writeFile).toHaveBeenCalledWith(
        '/mock/config.json',
        JSON.stringify(config, null, 2),
      );
    });

    it('sets language on save', async () => {
      await handlers.get('save-config')({}, { language: 'en' });
      expect(setLanguage).toHaveBeenCalledWith('en');
    });

    it('returns error on write failure', async () => {
      writeFile.mockRejectedValueOnce(new Error('disk full'));
      const result = await handlers.get('save-config')({}, {});
      expect(result.ok).toBe(false);
      expect(result.error).toBe('disk full');
    });
  });
});
