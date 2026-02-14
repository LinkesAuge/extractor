import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LOGS_DIR before importing the module
vi.mock('../../../src/utils/paths.js', () => ({
  LOGS_DIR: '/mock/logs',
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

const { createGuiLogger, startLogSession } = await import('../../../src/services/gui-logger.js');

describe('createGuiLogger', () => {
  let mockWindow;
  let logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindow = {
      webContents: { send: vi.fn() },
    };
    logger = createGuiLogger(() => mockWindow);
  });

  it('creates logger with all four levels', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.success).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('sends log messages to the renderer via IPC', () => {
    logger.info('Test message');
    expect(mockWindow.webContents.send).toHaveBeenCalledWith('log', {
      level: 'info',
      message: 'Test message',
    });
  });

  it('sends correct level for each method', () => {
    logger.info('i');
    logger.success('s');
    logger.warn('w');
    logger.error('e');
    const calls = mockWindow.webContents.send.mock.calls;
    expect(calls[0][1].level).toBe('info');
    expect(calls[1][1].level).toBe('success');
    expect(calls[2][1].level).toBe('warn');
    expect(calls[3][1].level).toBe('error');
  });

  it('handles null window gracefully', () => {
    const nullLogger = createGuiLogger(() => null);
    expect(() => nullLogger.info('no window')).not.toThrow();
  });
});

describe('startLogSession', () => {
  it('returns a log file path with prefix', async () => {
    const path = await startLogSession('test-prefix');
    expect(path).toContain('test-prefix');
    expect(path).toMatch(/\.log$/);
  });
});
