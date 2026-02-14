import { describe, it, expect } from 'vitest';
import { isNoiseToken } from '../../../src/ocr/noise-detector.js';

describe('isNoiseToken', () => {
  describe('1-2 character tokens', () => {
    it('rejects single uppercase letters', () => {
      expect(isNoiseToken('A')).toBe(true);
      expect(isNoiseToken('Z')).toBe(true);
      expect(isNoiseToken('Ö')).toBe(true);
    });

    it('rejects single lowercase letters', () => {
      expect(isNoiseToken('a')).toBe(true);
      expect(isNoiseToken('z')).toBe(true);
    });

    it('rejects 1-2 digit numbers', () => {
      expect(isNoiseToken('5')).toBe(true);
      expect(isNoiseToken('42')).toBe(true);
    });

    it('rejects mixed case 2-char tokens', () => {
      expect(isNoiseToken('Ab')).toBe(true);
      expect(isNoiseToken('aB')).toBe(true);
    });

    it('rejects letter+digit combos', () => {
      expect(isNoiseToken('A1')).toBe(true);
      expect(isNoiseToken('3b')).toBe(true);
    });

    it('rejects special characters', () => {
      expect(isNoiseToken('.')).toBe(true);
      expect(isNoiseToken('--')).toBe(true);
    });
  });

  describe('3-4 character tokens', () => {
    it('rejects 3-letter all-caps', () => {
      expect(isNoiseToken('ABC')).toBe(true);
      expect(isNoiseToken('ÄÖÜ')).toBe(true);
    });

    it('rejects mixed alpha-numeric', () => {
      expect(isNoiseToken('A1B')).toBe(true);
      expect(isNoiseToken('12ab')).toBe(true);
    });

    it('rejects pure digits', () => {
      expect(isNoiseToken('123')).toBe(true);
      expect(isNoiseToken('9999')).toBe(true);
    });

    it('accepts valid short names', () => {
      expect(isNoiseToken('Ace')).toBe(false);
      expect(isNoiseToken('Max')).toBe(false);
    });
  });

  describe('5+ character tokens', () => {
    it('rejects pure digits', () => {
      expect(isNoiseToken('12345')).toBe(true);
    });

    it('rejects non-letter sequences', () => {
      expect(isNoiseToken('---.-')).toBe(true);
    });

    it('accepts normal names', () => {
      expect(isNoiseToken('Player')).toBe(false);
      expect(isNoiseToken('DragonSlayer')).toBe(false);
      expect(isNoiseToken('König')).toBe(false);
    });
  });
});
