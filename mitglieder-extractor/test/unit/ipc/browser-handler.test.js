import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock chain ─────────────────────────────────────────────────────────────

const handlers = new Map();
const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  title: vi.fn().mockResolvedValue('Total Battle'),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn(() => ({
    first: vi.fn(() => ({
      isVisible: vi.fn().mockResolvedValue(false),
    })),
  })),
  keyboard: { press: vi.fn() },
};

const mockContext = {
  pages: vi.fn(() => [mockPage]),
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockChromium = {
  launchPersistentContext: vi.fn().mockResolvedValue(mockContext),
};

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch, fn) => handlers.set(ch, fn)) },
  app: { isPackaged: false, getPath: () => '/mock' },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/utils/paths.js', () => ({
  BROWSER_PROFILE_DIR: '/mock/browser-profile',
  APP_DATA_DIR: '/mock/data',
  LOGS_DIR: '/mock/logs',
}));

vi.mock('../../../src/services/app-state.js', () => ({
  default: {
    mainWindow: { webContents: { send: vi.fn() } },
    browserContext: null,
    page: null,
  },
}));

vi.mock('../../../src/validation-manager.js', () => ({
  default: class {},
}));

// Mock the dynamic import of playwright inside getChromium()
vi.mock('playwright', () => ({
  chromium: mockChromium,
}));

const { default: appState } = await import('../../../src/services/app-state.js');
const { registerBrowserHandlers } = await import('../../../src/ipc/browser-handler.js');
const mockLogger = { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('browser-handler', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    appState.browserContext = null;
    appState.page = null;
    registerBrowserHandlers(mockLogger);
  });

  it('registers all expected channels', () => {
    expect(handlers.has('launch-browser')).toBe(true);
    expect(handlers.has('close-browser')).toBe(true);
    expect(handlers.has('auto-login')).toBe(true);
  });

  describe('launch-browser', () => {
    it('launches a persistent browser context', async () => {
      const result = await handlers.get('launch-browser')({}, 'https://example.com');
      expect(result.ok).toBe(true);
      expect(mockChromium.launchPersistentContext).toHaveBeenCalledWith(
        '/mock/browser-profile',
        expect.objectContaining({
          headless: false,
          viewport: { width: 1920, height: 1080 },
          locale: 'de-DE',
        }),
      );
    });

    it('sets appState.browserContext and page', async () => {
      await handlers.get('launch-browser')({}, 'https://example.com');
      expect(appState.browserContext).toBe(mockContext);
      expect(appState.page).toBe(mockPage);
    });

    it('navigates to the provided URL', async () => {
      await handlers.get('launch-browser')({}, 'https://example.com');
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ waitUntil: 'domcontentloaded' }),
      );
    });

    it('sends browser-status IPC events', async () => {
      await handlers.get('launch-browser')({}, 'https://example.com');
      const calls = appState.mainWindow.webContents.send.mock.calls;
      const statusMessages = calls.filter(c => c[0] === 'browser-status').map(c => c[1].status);
      expect(statusMessages).toContain('launching');
      expect(statusMessages).toContain('navigating');
      expect(statusMessages).toContain('ready');
    });

    it('closes existing browser context before launching', async () => {
      appState.browserContext = mockContext;
      await handlers.get('launch-browser')({}, 'https://example.com');
      // close() called once (on existing context), then a new launch
      expect(mockContext.close).toHaveBeenCalled();
    });

    it('returns error when launch fails', async () => {
      mockChromium.launchPersistentContext.mockRejectedValueOnce(new Error('launch failed'));
      const result = await handlers.get('launch-browser')({}, 'https://example.com');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('launch failed');
    });
  });

  describe('close-browser', () => {
    it('closes the browser context and clears state', async () => {
      appState.browserContext = mockContext;
      appState.page = mockPage;
      const result = await handlers.get('close-browser')({});
      expect(result.ok).toBe(true);
      expect(mockContext.close).toHaveBeenCalled();
      expect(appState.browserContext).toBeNull();
      expect(appState.page).toBeNull();
    });

    it('succeeds when no browser is open', async () => {
      appState.browserContext = null;
      const result = await handlers.get('close-browser')({});
      expect(result.ok).toBe(true);
    });
  });

  describe('auto-login', () => {
    it('returns error when browser is not started', async () => {
      appState.page = null;
      const result = await handlers.get('auto-login')({}, { email: 'a@b.com', password: 'pw' });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Browser nicht gestartet');
    });

    it('attempts login when browser is running', async () => {
      appState.page = mockPage;
      const result = await handlers.get('auto-login')({}, { email: 'a@b.com', password: 'pw' });
      // The login flow searches for form elements and eventually presses Enter
      expect(mockPage.waitForLoadState).toHaveBeenCalled();
    });
  });
});
