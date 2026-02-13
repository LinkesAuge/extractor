import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock chain ─────────────────────────────────────────────────────────────

const handlers = new Map();

const mockProcessFolder = vi.fn().mockResolvedValue([
  { rank: 'Mitglied', name: 'Player1', coords: 'K:1 X:1 Y:1', score: 5000000 },
]);
const mockProcessEventFolder = vi.fn().mockResolvedValue([
  { name: 'Player1', power: 3000000, eventPoints: 15000 },
]);

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch, fn) => handlers.set(ch, fn)) },
  dialog: {
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/mock/export.csv' }),
  },
  app: { isPackaged: false, getPath: () => '/mock' },
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/paths.js', () => ({
  MEMBER_RESULTS_DIR: '/mock/results/mitglieder',
  EVENT_RESULTS_DIR: '/mock/results/events',
  APP_DATA_DIR: '/mock/data',
  LOGS_DIR: '/mock/logs',
}));

vi.mock('../../../src/utils/date.js', () => ({
  localDate: vi.fn(() => '2026-02-13'),
}));

vi.mock('../../../src/services/i18n-backend.js', () => ({
  dt: vi.fn(k => k),
}));

vi.mock('../../../src/services/app-state.js', () => ({
  default: {
    mainWindow: { webContents: { send: vi.fn() } },
    ocrProcessor: null,
    eventOcrProcessor: null,
  },
}));

vi.mock('../../../src/validation-manager.js', () => ({
  default: class {},
}));

vi.mock('../../../src/ocr-processor.js', () => ({
  default: class MockOcrProcessor {
    constructor() {
      this.aborted = false;
    }
    abort() { this.aborted = true; }
    async processFolder(path, onProgress) {
      return mockProcessFolder(path, onProgress);
    }
    async processEventFolder(path, onProgress) {
      return mockProcessEventFolder(path, onProgress);
    }
    static toCSV(members) {
      return '\uFEFFRang,Name,Koordinaten,Score\r\n' +
        members.map(m => `${m.rank},"${m.name}","${m.coords}",${m.score}`).join('\r\n');
    }
    static toEventCSV(entries) {
      return '\uFEFFName,Macht,Event-Punkte\r\n' +
        entries.map(e => `"${e.name}",${e.power},${e.eventPoints}`).join('\r\n');
    }
  },
}));

vi.mock('../../../src/ocr/provider-factory.js', () => ({
  createOcrProvider: vi.fn(({ logger }) => ({
    aborted: false,
    abort() { this.aborted = true; },
    async processFolder(path, onProgress) {
      return mockProcessFolder(path, onProgress);
    },
    async processEventFolder(path, onProgress) {
      return mockProcessEventFolder(path, onProgress);
    },
  })),
}));

vi.mock('../../../src/services/gui-logger.js', () => ({
  startLogSession: vi.fn().mockResolvedValue('/mock/logs/session.log'),
}));

const { writeFile } = await import('fs/promises');
const { default: appState } = await import('../../../src/services/app-state.js');
const { registerOcrHandlers } = await import('../../../src/ipc/ocr-handler.js');
const mockLogger = { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('ocr-handler', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    appState.ocrProcessor = null;
    appState.eventOcrProcessor = null;
    registerOcrHandlers(mockLogger);
  });

  it('registers all expected channels', () => {
    const expected = [
      'start-ocr', 'stop-ocr',
      'start-event-ocr', 'stop-event-ocr',
      'export-csv', 'export-event-csv',
      'auto-save-csv', 'auto-save-event-csv',
    ];
    for (const ch of expected) {
      expect(handlers.has(ch)).toBe(true);
    }
  });

  // ─── Start/Stop OCR ─────────────────────────────────────────────────

  describe('start-ocr', () => {
    it('processes a folder and returns member results', async () => {
      const result = await handlers.get('start-ocr')({}, '/captures/test', {});
      expect(result.ok).toBe(true);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].name).toBe('Player1');
      expect(mockProcessFolder).toHaveBeenCalled();
    });

    it('stores processor in appState during execution', async () => {
      // The mock processor is created and cleared within the handler
      mockProcessFolder.mockImplementationOnce(async () => {
        expect(appState.ocrProcessor).not.toBeNull();
        return [];
      });
      await handlers.get('start-ocr')({}, '/captures/test', {});
      expect(appState.ocrProcessor).toBeNull(); // cleared after
    });

    it('returns error when processing fails', async () => {
      mockProcessFolder.mockRejectedValueOnce(new Error('no files'));
      const result = await handlers.get('start-ocr')({}, '/bad/path', {});
      expect(result.ok).toBe(false);
      expect(result.error).toBe('no files');
    });
  });

  describe('stop-ocr', () => {
    it('aborts the current processor', async () => {
      const mockProcessor = { abort: vi.fn() };
      appState.ocrProcessor = mockProcessor;
      const result = await handlers.get('stop-ocr')({});
      expect(result.ok).toBe(true);
      expect(mockProcessor.abort).toHaveBeenCalled();
    });

    it('succeeds when no processor is active', async () => {
      appState.ocrProcessor = null;
      const result = await handlers.get('stop-ocr')({});
      expect(result.ok).toBe(true);
    });
  });

  // ─── Event OCR ──────────────────────────────────────────────────────

  describe('start-event-ocr', () => {
    it('processes event folder and returns entries', async () => {
      const result = await handlers.get('start-event-ocr')({}, '/captures/events', {});
      expect(result.ok).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('Player1');
    });
  });

  describe('stop-event-ocr', () => {
    it('aborts the event processor', async () => {
      const mockProcessor = { abort: vi.fn() };
      appState.eventOcrProcessor = mockProcessor;
      const result = await handlers.get('stop-event-ocr')({});
      expect(result.ok).toBe(true);
      expect(mockProcessor.abort).toHaveBeenCalled();
    });
  });

  // ─── CSV Export ─────────────────────────────────────────────────────

  describe('export-csv', () => {
    it('shows save dialog and writes CSV', async () => {
      const data = [{ rank: 'Mitglied', name: 'Test', coords: 'K:1', score: 100 }];
      const result = await handlers.get('export-csv')({}, data, 'test.csv');
      expect(result.ok).toBe(true);
      expect(result.path).toBe('/mock/export.csv');
      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe('export-event-csv', () => {
    it('shows save dialog and writes event CSV', async () => {
      const data = [{ name: 'Test', power: 100, eventPoints: 50 }];
      const result = await handlers.get('export-event-csv')({}, data, 'event.csv');
      expect(result.ok).toBe(true);
    });
  });

  // ─── Auto-Save ──────────────────────────────────────────────────────

  describe('auto-save-csv', () => {
    it('saves CSV with date-stamped filename', async () => {
      const data = [{ rank: 'Mitglied', name: 'Test', coords: 'K:1', score: 100 }];
      const result = await handlers.get('auto-save-csv')({}, data);
      expect(result.ok).toBe(true);
      expect(result.fileName).toBe('mitglieder_2026-02-13.csv');
      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe('auto-save-event-csv', () => {
    it('saves event CSV with date-stamped filename', async () => {
      const data = [{ name: 'Test', power: 100, eventPoints: 50 }];
      const result = await handlers.get('auto-save-event-csv')({}, data);
      expect(result.ok).toBe(true);
      expect(result.fileName).toBe('event_2026-02-13.csv');
    });
  });
});
