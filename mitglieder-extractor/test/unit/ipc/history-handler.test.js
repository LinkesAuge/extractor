import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock chain ─────────────────────────────────────────────────────────────

const handlers = new Map();
const BOM = '\uFEFF';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch, fn) => handlers.set(ch, fn)) },
  app: { isPackaged: false, getPath: () => '/mock' },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ mtime: new Date(), size: 100 }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/paths.js', () => ({
  RESULTS_DIR: '/mock/results',
  MEMBER_RESULTS_DIR: '/mock/results/mitglieder',
  EVENT_RESULTS_DIR: '/mock/results/events',
  APP_DATA_DIR: '/mock/data',
  LOGS_DIR: '/mock/logs',
}));

vi.mock('../../../src/services/app-state.js', () => ({
  default: {
    mainWindow: null,
    validationManager: { load: vi.fn(), save: vi.fn(), getState: vi.fn() },
  },
}));

vi.mock('../../../src/validation-manager.js', () => ({
  default: class {},
  ValidationManager: class {},
}));

const { readFile, readdir, stat, unlink } = await import('fs/promises');
const { registerHistoryHandlers } = await import('../../../src/ipc/history-handler.js');
const mockLogger = { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('history-handler', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerHistoryHandlers(mockLogger);
  });

  it('registers all expected channels', () => {
    expect(handlers.has('load-history')).toBe(true);
    expect(handlers.has('load-history-entry')).toBe(true);
    expect(handlers.has('delete-history-entry')).toBe(true);
  });

  describe('load-history', () => {
    it('returns empty entries for empty directories', async () => {
      readdir.mockResolvedValue([]);
      const result = await handlers.get('load-history')({});
      expect(result.ok).toBe(true);
      expect(result.entries).toEqual([]);
    });

    it('parses new datetime filename format with time', async () => {
      const csv = 'Rang,Name,Koordinaten,Score\r\nAnführer,"Alice","K:1",100';
      readdir
        .mockResolvedValueOnce(['mitglieder_2026-02-14_17-30-45.csv']) // member dir
        .mockResolvedValueOnce([]) // event dir
        .mockResolvedValueOnce([]); // legacy dir
      readFile.mockResolvedValue(csv);
      stat.mockResolvedValue({ mtime: new Date('2026-02-14T17:30:45'), size: 200 });
      const result = await handlers.get('load-history')({});
      expect(result.ok).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].date).toBe('2026-02-14');
      expect(result.entries[0].time).toBe('17:30:45');
      expect(result.entries[0].memberCount).toBe(1);
    });

    it('parses legacy date-only filename format', async () => {
      const csv = 'Rang,Name,Koordinaten,Score\r\nAnführer,"Bob","K:2",200';
      readdir
        .mockResolvedValueOnce(['mitglieder_2026-02-14.csv']) // member dir
        .mockResolvedValueOnce([]) // event dir
        .mockResolvedValueOnce([]); // legacy dir
      readFile.mockResolvedValue(csv);
      stat.mockResolvedValue({ mtime: new Date('2026-02-14T10:00:00'), size: 150 });
      const result = await handlers.get('load-history')({});
      expect(result.ok).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].date).toBe('2026-02-14');
      expect(result.entries[0].time).toBeNull();
    });

    it('sorts entries newest first (new format before legacy)', async () => {
      const csv = 'Rang,Name,Koordinaten,Score\r\nAnführer,"X","K:1",100';
      readdir
        .mockResolvedValueOnce(['mitglieder_2026-02-13.csv', 'mitglieder_2026-02-14_09-00-00.csv'])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      readFile.mockResolvedValue(csv);
      stat.mockResolvedValue({ mtime: new Date(), size: 100 });
      const result = await handlers.get('load-history')({});
      expect(result.ok).toBe(true);
      expect(result.entries).toHaveLength(2);
      // Newer file should be first (sorted by fileName descending)
      expect(result.entries[0].fileName).toBe('mitglieder_2026-02-14_09-00-00.csv');
      expect(result.entries[1].fileName).toBe('mitglieder_2026-02-13.csv');
    });
  });

  describe('load-history-entry', () => {
    it('parses member CSV content', async () => {
      const csv = BOM + 'Rang,Name,Koordinaten,Score\r\nAnführer,"TestPlayer","K:1 X:100 Y:200",5000000';
      readFile.mockResolvedValueOnce(csv);
      const result = await handlers.get('load-history-entry')({}, 'mitglieder_2026-02-13.csv');
      expect(result.ok).toBe(true);
      expect(result.type).toBe('member');
      expect(result.members).toHaveLength(1);
      expect(result.members[0].name).toBe('TestPlayer');
      expect(result.members[0].score).toBe(5000000);
    });

    it('parses event CSV content', async () => {
      const csv = BOM + 'Name,Macht,Event-Punkte\r\n"Dragon",3000000,15000';
      readFile.mockResolvedValueOnce(csv);
      const result = await handlers.get('load-history-entry')({}, 'event_2026-02-13.csv');
      expect(result.ok).toBe(true);
      expect(result.type).toBe('event');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('Dragon');
      expect(result.entries[0].power).toBe(3000000);
    });

    it('handles empty CSV', async () => {
      readFile.mockResolvedValueOnce(BOM + 'Rang,Name,Koordinaten,Score');
      const result = await handlers.get('load-history-entry')({}, 'mitglieder_2026-02-13.csv');
      expect(result.ok).toBe(true);
      expect(result.members).toHaveLength(0);
    });
  });

  describe('delete-history-entry', () => {
    it('deletes the file and returns ok', async () => {
      const result = await handlers.get('delete-history-entry')({}, 'mitglieder_2026-02-13.csv');
      expect(result.ok).toBe(true);
      expect(unlink).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      unlink.mockRejectedValueOnce(new Error('ENOENT'));
      const result = await handlers.get('delete-history-entry')({}, 'no-such-file.csv');
      expect(result.ok).toBe(false);
    });
  });
});
