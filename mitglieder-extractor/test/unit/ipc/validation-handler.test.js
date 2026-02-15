import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock chain ─────────────────────────────────────────────────────────────

const handlers = new Map();
const mockValidationManager = {
  load: vi.fn().mockResolvedValue({ knownNames: [], corrections: {} }),
  save: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn(() => ({ knownNames: ['TestPlayer'], corrections: {} })),
  addName: vi.fn(() => true),
  removeName: vi.fn(() => true),
  addCorrection: vi.fn(),
  removeCorrection: vi.fn(),
  validateMembers: vi.fn(members => members.map(m => ({
    ...m,
    originalName: m.name,
    validationStatus: 'unknown',
    suggestion: null,
  }))),
  importNames: vi.fn(() => 5),
  exportData: vi.fn(() => ({ knownNames: ['A'], corrections: {} })),
  compareWithHistory: vi.fn(members => members),
  updatePlayerHistory: vi.fn(() => 0),
  playerHistory: {},
};

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch, fn) => handlers.set(ch, fn)) },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/import.json'] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/mock/export.json' }),
  },
  app: { isPackaged: false, getPath: () => '/mock' },
}));

const BOM = '\uFEFF';

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(`${'\uFEFF'}Name\r\n"ImportedName"`),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/paths.js', () => ({
  APP_DATA_DIR: '/mock/data',
  LOGS_DIR: '/mock/logs',
}));

vi.mock('../../../src/services/app-state.js', () => ({
  default: {
    mainWindow: { webContents: { send: vi.fn() } },
    validationManager: mockValidationManager,
  },
}));

vi.mock('../../../src/services/i18n-backend.js', () => ({
  dt: vi.fn(k => k),
}));

// Must also mock the transitive dep from validation-manager
vi.mock('../../../src/validation-manager.js', () => ({
  default: class {},
  ValidationManager: class {},
}));

const { registerValidationHandlers } = await import('../../../src/ipc/validation-handler.js');
const mockLogger = { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('validation-handler', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerValidationHandlers(mockLogger);
  });

  it('registers all expected channels', () => {
    const expected = [
      'load-validation-list', 'save-validation-list',
      'add-validation-name', 'remove-validation-name',
      'add-correction', 'remove-correction',
      'validate-ocr-results', 'update-player-history',
      'import-validation-names-csv', 'export-validation-names-csv',
      'import-corrections-csv', 'export-corrections-csv',
    ];
    for (const ch of expected) {
      expect(handlers.has(ch)).toBe(true);
    }
  });

  describe('load-validation-list', () => {
    it('loads and returns state', async () => {
      const result = await handlers.get('load-validation-list')({});
      expect(result.ok).toBe(true);
      expect(mockValidationManager.load).toHaveBeenCalled();
    });
  });

  describe('add-validation-name', () => {
    it('adds name and saves', async () => {
      const result = await handlers.get('add-validation-name')({}, 'NewPlayer');
      expect(result.ok).toBe(true);
      expect(result.added).toBe(true);
      expect(mockValidationManager.addName).toHaveBeenCalledWith('NewPlayer');
      expect(mockValidationManager.save).toHaveBeenCalled();
    });
  });

  describe('remove-validation-name', () => {
    it('removes name and saves', async () => {
      const result = await handlers.get('remove-validation-name')({}, 'OldPlayer');
      expect(result.ok).toBe(true);
      expect(mockValidationManager.removeName).toHaveBeenCalledWith('OldPlayer');
    });
  });

  describe('add-correction', () => {
    it('adds correction and saves', async () => {
      const result = await handlers.get('add-correction')({}, 'Playr', 'Player');
      expect(result.ok).toBe(true);
      expect(mockValidationManager.addCorrection).toHaveBeenCalledWith('Playr', 'Player');
    });
  });

  describe('validate-ocr-results', () => {
    it('validates members through the manager', async () => {
      const members = [{ name: 'Test' }];
      const result = await handlers.get('validate-ocr-results')({}, members, {});
      expect(result.ok).toBe(true);
      expect(result.members).toHaveLength(1);
    });
  });

  describe('import-validation-names-csv', () => {
    it('imports names from CSV file', async () => {
      const result = await handlers.get('import-validation-names-csv')({});
      expect(result.ok).toBe(true);
      expect(result.added).toBe(5);
      expect(mockValidationManager.importNames).toHaveBeenCalled();
    });
  });

  describe('export-validation-names-csv', () => {
    it('exports names as CSV', async () => {
      const result = await handlers.get('export-validation-names-csv')({});
      expect(result.ok).toBe(true);
      expect(result.path).toBe('/mock/export.json');
    });
  });

  describe('import-corrections-csv', () => {
    it('imports corrections from CSV file', async () => {
      const { readFile } = await import('fs/promises');
      readFile.mockResolvedValueOnce(`${BOM}OCR-Name,Korrekter Name\r\n"P1ayer","Player"`);
      const result = await handlers.get('import-corrections-csv')({});
      expect(result.ok).toBe(true);
      expect(result.added).toBe(1);
      expect(mockValidationManager.addCorrection).toHaveBeenCalledWith('P1ayer', 'Player');
    });
  });

  describe('export-corrections-csv', () => {
    it('exports corrections as CSV', async () => {
      const result = await handlers.get('export-corrections-csv')({});
      expect(result.ok).toBe(true);
    });
  });
});
