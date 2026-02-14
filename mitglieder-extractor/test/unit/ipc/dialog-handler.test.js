import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock chain ─────────────────────────────────────────────────────────────

const handlers = new Map();
const mockShell = { openPath: vi.fn().mockResolvedValue('') };
const mockDialog = {
  showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/selected'] }),
  showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/mock/save' }),
};

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch, fn) => handlers.set(ch, fn)) },
  shell: mockShell,
  dialog: mockDialog,
  app: { isPackaged: false, getPath: () => '/mock' },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
}));

vi.mock('../../../src/utils/paths.js', () => ({
  LOGS_DIR: '/mock/data/logs',
  RESULTS_DIR: '/mock/data/results',
  APP_DATA_DIR: '/mock/data',
  DEFAULT_MEMBER_CAPTURES_DIR: '/mock/captures/mitglieder',
  DEFAULT_EVENT_CAPTURES_DIR: '/mock/captures/events',
}));

vi.mock('../../../src/services/i18n-backend.js', () => ({
  dt: vi.fn(k => k),
}));

vi.mock('../../../src/services/app-state.js', () => ({
  default: { mainWindow: {} },
}));

vi.mock('../../../src/validation-manager.js', () => ({
  default: class {},
  ValidationManager: class {},
}));

const { resolve } = await import('path');
const { rm } = await import('fs/promises');
const { registerDialogHandlers } = await import('../../../src/ipc/dialog-handler.js');
const mockLogger = { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('dialog-handler', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerDialogHandlers(mockLogger);
  });

  it('registers all expected channels', () => {
    const expected = [
      'open-folder', 'open-screenshot', 'open-log-folder', 'open-results-dir',
      'browse-folder', 'browse-capture-folder', 'delete-folder',
    ];
    for (const ch of expected) {
      expect(handlers.has(ch)).toBe(true);
    }
  });

  describe('open-folder', () => {
    it('opens the folder via shell when path is allowed', async () => {
      const allowedPath = resolve('/mock/data', 'results', 'sub');
      const result = await handlers.get('open-folder')({}, allowedPath);
      expect(result.ok).toBe(true);
      expect(mockShell.openPath).toHaveBeenCalled();
    });

    it('rejects paths outside allowed directories', async () => {
      const result = await handlers.get('open-folder')({}, resolve('/not', 'allowed'));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Zugriff verweigert');
    });
  });

  describe('open-log-folder', () => {
    it('creates logs dir and opens it', async () => {
      const result = await handlers.get('open-log-folder')({});
      expect(result.ok).toBe(true);
      expect(mockShell.openPath).toHaveBeenCalledWith('/mock/data/logs');
    });
  });

  describe('browse-folder', () => {
    it('returns selected path', async () => {
      const result = await handlers.get('browse-folder')({}, {});
      expect(result.ok).toBe(true);
      expect(result.path).toBe('/mock/selected');
    });

    it('returns ok: false when dialog canceled', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
      const result = await handlers.get('browse-folder')({}, {});
      expect(result.ok).toBe(false);
    });
  });

  describe('browse-capture-folder', () => {
    it('returns directory path for directory selection', async () => {
      const result = await handlers.get('browse-capture-folder')({}, '/default');
      expect(result.ok).toBe(true);
      expect(result.path).toBe('/mock/selected');
    });
  });

  describe('delete-folder', () => {
    it('deletes the folder when path is allowed', async () => {
      const allowedPath = resolve('/mock/data', 'results', 'old');
      const result = await handlers.get('delete-folder')({}, allowedPath);
      expect(result.ok).toBe(true);
      expect(rm).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalled();
    });

    it('rejects paths outside allowed directories', async () => {
      const result = await handlers.get('delete-folder')({}, resolve('/not', 'allowed'));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Zugriff verweigert');
    });

    it('returns error on failure', async () => {
      rm.mockRejectedValueOnce(new Error('permission denied'));
      const allowedPath = resolve('/mock/data', 'results', 'old');
      const result = await handlers.get('delete-folder')({}, allowedPath);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('permission denied');
    });
  });
});
