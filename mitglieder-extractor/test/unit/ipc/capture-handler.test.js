import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock chain ─────────────────────────────────────────────────────────────

const handlers = new Map();
const mockScreenshot = Buffer.from('fake-png');
const mockPage = {
  screenshot: vi.fn().mockResolvedValue(mockScreenshot),
  mouse: {
    move: vi.fn().mockResolvedValue(undefined),
    wheel: vi.fn().mockResolvedValue(undefined),
  },
};

const mockSelectRegion = vi.fn().mockResolvedValue({ x: 100, y: 100, width: 500, height: 400 });
const mockTestScroll = vi.fn().mockResolvedValue({
  before: Buffer.from('before'), after: Buffer.from('after'), similarity: 0.5,
});

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch, fn) => handlers.set(ch, fn)) },
  app: { isPackaged: false, getPath: () => '/mock' },
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/paths.js', () => ({
  BROWSER_PROFILE_DIR: '/mock/browser',
  APP_DATA_DIR: '/mock/data',
  LOGS_DIR: '/mock/logs',
}));

vi.mock('../../../src/services/app-state.js', () => ({
  default: {
    mainWindow: { webContents: { send: vi.fn() } },
    browserContext: {},
    page: mockPage,
    captureAborted: false,
    eventCaptureAborted: false,
  },
}));

vi.mock('../../../src/validation-manager.js', () => ({
  default: class {},
}));

vi.mock('../../../src/region-selector.js', () => ({
  default: mockSelectRegion,
}));

vi.mock('../../../src/scroll-capturer.js', () => ({
  default: class MockScrollCapturer {
    constructor() {}
    async testScroll(region) { return mockTestScroll(region); }
    static async compareBuffers() { return 0.5; }
  },
}));

vi.mock('../../../src/services/gui-logger.js', () => ({
  startLogSession: vi.fn().mockResolvedValue('/mock/logs/session.log'),
}));

const { default: appState } = await import('../../../src/services/app-state.js');
const { registerCaptureHandlers } = await import('../../../src/ipc/capture-handler.js');
const mockLogger = { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('capture-handler', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    appState.page = mockPage;
    appState.captureAborted = false;
    appState.eventCaptureAborted = false;
    registerCaptureHandlers(mockLogger);
  });

  it('registers all expected channels', () => {
    const expected = [
      'select-region', 'select-event-region',
      'preview-region', 'preview-event-region',
      'test-scroll', 'test-event-scroll',
      'start-capture', 'start-event-capture',
      'stop-capture', 'stop-event-capture',
    ];
    for (const ch of expected) {
      expect(handlers.has(ch)).toBe(true);
    }
  });

  // ─── Region Selection ───────────────────────────────────────────────

  describe('select-region', () => {
    it('selects a region and returns preview', async () => {
      const result = await handlers.get('select-region')({});
      expect(result.ok).toBe(true);
      expect(result.region).toEqual({ x: 100, y: 100, width: 500, height: 400 });
      expect(result.preview).toBeDefined();
    });

    it('returns error when browser is not started', async () => {
      appState.page = null;
      const result = await handlers.get('select-region')({});
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Browser nicht gestartet');
    });
  });

  // ─── Region Preview ─────────────────────────────────────────────────

  describe('preview-region', () => {
    it('returns a base64 preview screenshot', async () => {
      const region = { x: 10, y: 10, width: 100, height: 100 };
      const result = await handlers.get('preview-region')({}, region);
      expect(result.ok).toBe(true);
      expect(typeof result.preview).toBe('string');
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({ clip: region }),
      );
    });

    it('returns error when browser is not started', async () => {
      appState.page = null;
      const result = await handlers.get('preview-region')({}, {});
      expect(result.ok).toBe(false);
    });
  });

  // ─── Scroll Test ────────────────────────────────────────────────────

  describe('test-scroll', () => {
    it('performs scroll test and returns similarity', async () => {
      const options = { region: { x: 0, y: 0, width: 100, height: 100 }, scrollDistance: 500 };
      const result = await handlers.get('test-scroll')({}, options);
      expect(result.ok).toBe(true);
      expect(typeof result.similarity).toBe('number');
      expect(result.before).toBeDefined();
      expect(result.after).toBeDefined();
    });

    it('returns error when browser is not started', async () => {
      appState.page = null;
      const result = await handlers.get('test-scroll')({}, { region: {} });
      expect(result.ok).toBe(false);
    });
  });

  // ─── Stop Capture ───────────────────────────────────────────────────

  describe('stop-capture', () => {
    it('sets captureAborted flag', async () => {
      const result = await handlers.get('stop-capture')({});
      expect(result.ok).toBe(true);
      expect(appState.captureAborted).toBe(true);
    });
  });

  describe('stop-event-capture', () => {
    it('sets eventCaptureAborted flag', async () => {
      const result = await handlers.get('stop-event-capture')({});
      expect(result.ok).toBe(true);
      expect(appState.eventCaptureAborted).toBe(true);
    });
  });

  // ─── Start Capture ──────────────────────────────────────────────────

  describe('start-capture', () => {
    it('returns error when browser is not started', async () => {
      appState.page = null;
      const result = await handlers.get('start-capture')({}, {
        region: { x: 0, y: 0, width: 100, height: 100 },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Browser nicht gestartet');
    });

    it('captures screenshots and returns count and outputDir', async () => {
      const options = {
        region: { x: 0, y: 0, width: 100, height: 100 },
        maxScreenshots: 2,
        scrollDistance: 100,
        scrollDelay: 10,
      };
      const result = await handlers.get('start-capture')({}, options);
      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
      expect(typeof result.outputDir).toBe('string');
    });

    it('stops when aborted during capture loop', async () => {
      // Simulate abort triggered after first screenshot
      let callCount = 0;
      mockPage.screenshot.mockImplementation(async () => {
        callCount++;
        if (callCount >= 2) appState.captureAborted = true;
        return mockScreenshot;
      });
      const options = {
        region: { x: 0, y: 0, width: 100, height: 100 },
        maxScreenshots: 10,
        scrollDistance: 100,
        scrollDelay: 1,
      };
      const result = await handlers.get('start-capture')({}, options);
      expect(result.ok).toBe(true);
      expect(result.count).toBeLessThan(10);
    });
  });
});
