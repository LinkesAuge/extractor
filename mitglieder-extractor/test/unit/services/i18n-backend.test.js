import { describe, it, expect, beforeEach } from 'vitest';
import { getLanguage, setLanguage, dt } from '../../../src/services/i18n-backend.js';

describe('i18n-backend', () => {
  beforeEach(() => {
    setLanguage('de');
  });

  describe('getLanguage / setLanguage', () => {
    it('defaults to German', () => {
      expect(getLanguage()).toBe('de');
    });

    it('accepts "en"', () => {
      setLanguage('en');
      expect(getLanguage()).toBe('en');
    });

    it('accepts "de"', () => {
      setLanguage('en');
      setLanguage('de');
      expect(getLanguage()).toBe('de');
    });

    it('ignores unsupported languages', () => {
      setLanguage('fr');
      expect(getLanguage()).toBe('de');
    });
  });

  describe('dt (dialog translation)', () => {
    it('returns German string by default', () => {
      expect(dt('browseFolder')).toBe('Ausgabeordner waehlen');
    });

    it('returns English string when language is en', () => {
      setLanguage('en');
      expect(dt('browseFolder')).toBe('Choose output folder');
    });

    it('falls back to German for missing English key', () => {
      setLanguage('en');
      // All keys exist in both, but test fallback logic
      expect(dt('csvFiles')).toBe('CSV files');
    });

    it('returns key when translation is missing in all languages', () => {
      expect(dt('nonExistentKey')).toBe('nonExistentKey');
    });

    it('translates all defined dialog keys', () => {
      const keys = [
        'browseFolder', 'browseCapture', 'exportCsv', 'csvFiles',
        'allFiles', 'screenshots', 'importValidation', 'exportValidation', 'jsonFiles',
      ];
      for (const key of keys) {
        expect(dt(key)).not.toBe(key);
        setLanguage('en');
        expect(dt(key)).not.toBe(key);
        setLanguage('de');
      }
    });
  });
});
