import { describe, it, expect } from 'vitest';
import {
  RANK_PATTERNS, COORD_REGEX, CLAN_TAG_REGEX,
  PUNKTE_REGEX, SCORE_REGEX, SCORE_FALLBACK_REGEX, DEFAULT_SETTINGS,
} from '../../../src/ocr/constants.js';

describe('RANK_PATTERNS', () => {
  const ranks = ['Anführer', 'Vorgesetzter', 'Offizier', 'Mitglied', 'Rekrut', 'Veteran', 'Hauptmann', 'General'];

  it('contains all expected ranks', () => {
    const normalized = RANK_PATTERNS.map(r => r.normalized);
    for (const rank of ranks) {
      expect(normalized).toContain(rank);
    }
  });

  it('matches case-insensitive variations', () => {
    const anfuehrerPattern = RANK_PATTERNS.find(r => r.normalized === 'Anführer');
    expect(anfuehrerPattern.pattern.test('ANFÜHRER')).toBe(true);
    expect(anfuehrerPattern.pattern.test('anfuhrer')).toBe(true);
    expect(anfuehrerPattern.pattern.test('Anführer')).toBe(true);
  });
});

describe('COORD_REGEX', () => {
  it('matches standard coordinate format', () => {
    const text = 'K:98 X:707 Y:919';
    const match = new RegExp(COORD_REGEX.source, COORD_REGEX.flags).exec(text);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('98');
    expect(match[2]).toBe('707');
    expect(match[3]).toBe('919');
  });

  it('matches parenthesized coordinates', () => {
    const text = '(K:1 X:100 Y:200)';
    const match = new RegExp(COORD_REGEX.source, COORD_REGEX.flags).exec(text);
    expect(match).not.toBeNull();
  });

  it('handles OCR errors: K→1, Y→V', () => {
    const text = '1:98 X:707 V:919';
    const match = new RegExp(COORD_REGEX.source, COORD_REGEX.flags).exec(text);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('98');
    expect(match[3]).toBe('919');
  });

  it('handles semicolons and dots as separators', () => {
    const text = 'K;98 X.707 Y;919';
    const match = new RegExp(COORD_REGEX.source, COORD_REGEX.flags).exec(text);
    expect(match).not.toBeNull();
  });
});

describe('CLAN_TAG_REGEX', () => {
  it('matches [K98] format', () => {
    const match = new RegExp(CLAN_TAG_REGEX.source, CLAN_TAG_REGEX.flags).exec('[K98]');
    expect(match).not.toBeNull();
    expect(match[1]).toBe('98');
  });

  it('matches (K1) format', () => {
    const match = new RegExp(CLAN_TAG_REGEX.source, CLAN_TAG_REGEX.flags).exec('(K1)');
    expect(match).not.toBeNull();
    expect(match[1]).toBe('1');
  });
});

describe('SCORE_REGEX', () => {
  it('matches comma-separated scores', () => {
    const match = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags).exec('1,234,567');
    expect(match).not.toBeNull();
  });

  it('matches dot-separated scores', () => {
    const match = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags).exec('1.234.567');
    expect(match).not.toBeNull();
  });

  it('does not match plain 3-digit numbers', () => {
    const match = new RegExp(SCORE_REGEX.source, SCORE_REGEX.flags).exec('123');
    expect(match).toBeNull();
  });
});

describe('SCORE_FALLBACK_REGEX', () => {
  it('matches partially formatted scores', () => {
    const match = new RegExp(SCORE_FALLBACK_REGEX.source, SCORE_FALLBACK_REGEX.flags).exec('1922,130');
    expect(match).not.toBeNull();
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has all required fields', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('scale');
    expect(DEFAULT_SETTINGS).toHaveProperty('greyscale');
    expect(DEFAULT_SETTINGS).toHaveProperty('sharpen');
    expect(DEFAULT_SETTINGS).toHaveProperty('contrast');
    expect(DEFAULT_SETTINGS).toHaveProperty('threshold');
    expect(DEFAULT_SETTINGS).toHaveProperty('psm');
    expect(DEFAULT_SETTINGS).toHaveProperty('lang');
    expect(DEFAULT_SETTINGS).toHaveProperty('minScore');
  });

  it('has sensible defaults', () => {
    expect(DEFAULT_SETTINGS.scale).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.minScore).toBeGreaterThan(0);
    expect(typeof DEFAULT_SETTINGS.greyscale).toBe('boolean');
  });
});
