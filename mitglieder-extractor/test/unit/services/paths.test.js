import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';

// Mock electron.app BEFORE importing paths.js
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name) => {
      if (name === 'userData') return '/mock/userData';
      if (name === 'documents') return '/mock/documents';
      return '/mock/unknown';
    }),
  },
}));

const {
  APP_DATA_DIR, CONFIG_FILE, BROWSER_PROFILE_DIR,
  RESULTS_DIR, MEMBER_RESULTS_DIR, EVENT_RESULTS_DIR,
  LOGS_DIR, APP_ICON, DEFAULT_MEMBER_CAPTURES_DIR, DEFAULT_EVENT_CAPTURES_DIR,
} = await import('../../../src/utils/paths.js');

describe('paths (development mode)', () => {
  it('APP_DATA_DIR uses cwd in dev mode', () => {
    expect(APP_DATA_DIR).toBe(process.cwd());
  });

  it('CONFIG_FILE is in APP_DATA_DIR', () => {
    expect(CONFIG_FILE).toBe(join(process.cwd(), 'mitglieder-config.json'));
  });

  it('BROWSER_PROFILE_DIR is always in userData', () => {
    expect(BROWSER_PROFILE_DIR).toBe(join('/mock/userData', 'browser-profile'));
  });

  it('RESULTS_DIR is in APP_DATA_DIR', () => {
    expect(RESULTS_DIR).toBe(join(process.cwd(), 'results'));
  });

  it('MEMBER_RESULTS_DIR is under results/', () => {
    expect(MEMBER_RESULTS_DIR).toBe(join(process.cwd(), 'results', 'mitglieder'));
  });

  it('EVENT_RESULTS_DIR is under results/', () => {
    expect(EVENT_RESULTS_DIR).toBe(join(process.cwd(), 'results', 'events'));
  });

  it('LOGS_DIR is in APP_DATA_DIR', () => {
    expect(LOGS_DIR).toBe(join(process.cwd(), 'logs'));
  });

  it('APP_ICON points to the project icon in dev mode', () => {
    expect(APP_ICON).toContain('icons_main_menu_clan_1.png');
  });

  it('DEFAULT_MEMBER_CAPTURES_DIR uses cwd in dev mode', () => {
    expect(DEFAULT_MEMBER_CAPTURES_DIR).toBe(join(process.cwd(), 'captures', 'mitglieder'));
  });

  it('DEFAULT_EVENT_CAPTURES_DIR uses cwd in dev mode', () => {
    expect(DEFAULT_EVENT_CAPTURES_DIR).toBe(join(process.cwd(), 'captures', 'events'));
  });

  it('all exports are non-empty strings', () => {
    const allPaths = [
      APP_DATA_DIR, CONFIG_FILE, BROWSER_PROFILE_DIR,
      RESULTS_DIR, MEMBER_RESULTS_DIR, EVENT_RESULTS_DIR,
      LOGS_DIR, APP_ICON, DEFAULT_MEMBER_CAPTURES_DIR, DEFAULT_EVENT_CAPTURES_DIR,
    ];
    for (const p of allPaths) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    }
  });
});
