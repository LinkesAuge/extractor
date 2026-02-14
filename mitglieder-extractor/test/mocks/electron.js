/**
 * Mock Electron APIs for testing IPC handlers and services.
 * @module test/mocks/electron
 */

import { vi } from 'vitest';

/** Create a mock BrowserWindow with common methods. */
export function createMockWindow() {
  return {
    webContents: {
      send: vi.fn(),
    },
    loadFile: vi.fn(),
    setMenuBarVisibility: vi.fn(),
    on: vi.fn(),
  };
}

/** Create a mock ipcMain that records handler registrations. */
export function createMockIpcMain() {
  const handlers = new Map();
  return {
    handle: vi.fn((channel, handler) => {
      handlers.set(channel, handler);
    }),
    _handlers: handlers,
    /** Invoke a registered handler (simulates renderer calling invoke). */
    async invoke(channel, ...args) {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`No handler registered for channel: ${channel}`);
      return handler({}, ...args);
    },
  };
}

/** Create a mock dialog module. */
export function createMockDialog() {
  return {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/path'] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/mock/save.csv' }),
  };
}

/** Create a mock shell module. */
export function createMockShell() {
  return {
    openPath: vi.fn().mockResolvedValue(''),
    showItemInFolder: vi.fn(),
  };
}
