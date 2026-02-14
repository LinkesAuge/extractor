import { describe, it, expect, vi } from 'vitest';

// Mock the dependency chain before importing
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

vi.mock('../../../src/utils/paths.js', () => ({
  APP_DATA_DIR: '/mock/data',
}));

// Mock ValidationManager constructor
vi.mock('../../../src/validation-manager.js', () => ({
  default: class MockValidationManager {
    constructor(dataDir) {
      this.dataDir = dataDir;
      this.knownNames = [];
      this.corrections = {};
    }
  },
}));

const { default: appState } = await import('../../../src/services/app-state.js');

describe('appState', () => {
  it('exports a non-null object', () => {
    expect(appState).toBeDefined();
    expect(typeof appState).toBe('object');
  });

  it('has mainWindow initially null', () => {
    expect(appState.mainWindow).toBeNull();
  });

  it('has browserContext initially null', () => {
    expect(appState.browserContext).toBeNull();
  });

  it('has page initially null', () => {
    expect(appState.page).toBeNull();
  });

  it('has captureAborted initially false', () => {
    expect(appState.captureAborted).toBe(false);
  });

  it('has eventCaptureAborted initially false', () => {
    expect(appState.eventCaptureAborted).toBe(false);
  });

  it('has ocrProcessor initially null', () => {
    expect(appState.ocrProcessor).toBeNull();
  });

  it('has eventOcrProcessor initially null', () => {
    expect(appState.eventOcrProcessor).toBeNull();
  });

  it('creates a validationManager instance with APP_DATA_DIR', () => {
    expect(appState.validationManager).toBeDefined();
    expect(appState.validationManager.dataDir).toBe('/mock/data');
  });

  it('has all expected state keys', () => {
    const keys = [
      'mainWindow', 'browserContext', 'page',
      'captureAborted', 'eventCaptureAborted',
      'ocrProcessor', 'eventOcrProcessor', 'validationManager',
    ];
    for (const key of keys) {
      expect(appState).toHaveProperty(key);
    }
  });
});
