import { describe, it, expect } from 'vitest';
import { extractMemberName, extractEventName } from '../../../src/ocr/name-extractor.js';

describe('extractMemberName', () => {
  it('extracts a clean name before a coordinate', () => {
    const text = 'DragonSlayer K:1 X:100 Y:200';
    const coordIdx = text.indexOf('K:1');
    expect(extractMemberName(text, coordIdx)).toBe('DragonSlayer');
  });

  it('strips leading noise tokens', () => {
    const text = 'AB 42 DragonSlayer K:1 X:100 Y:200';
    const coordIdx = text.indexOf('K:1');
    expect(extractMemberName(text, coordIdx)).toBe('DragonSlayer');
  });

  it('strips trailing single lowercase letter', () => {
    const text = 'DragonSlayer a K:1 X:100 Y:200';
    const coordIdx = text.indexOf('K:1');
    expect(extractMemberName(text, coordIdx)).toBe('DragonSlayer');
  });

  it('converts pipe to I (roman numeral OCR fix)', () => {
    const text = 'Dragon|| K:1 X:100 Y:200';
    const coordIdx = text.indexOf('K:1');
    const result = extractMemberName(text, coordIdx);
    expect(result).toContain('DragonII');
  });

  it('fixes common roman numeral OCR errors', () => {
    const text = 'PlayerName Il K:1 X:100';
    const coordIdx = text.indexOf('K:1');
    expect(extractMemberName(text, coordIdx)).toBe('PlayerName II');
  });

  it('handles multi-word names', () => {
    const text = 'The Dark Knight K:5 X:50 Y:50';
    const coordIdx = text.indexOf('K:5');
    expect(extractMemberName(text, coordIdx)).toBe('The Dark Knight');
  });

  it('returns at least the raw text if everything is stripped', () => {
    const text = 'A K:1 X:1 Y:1';
    const coordIdx = text.indexOf('K:1');
    const result = extractMemberName(text, coordIdx);
    expect(result.length).toBeGreaterThan(0);
  });

  it('only reads from the current line', () => {
    const text = 'PreviousPlayer K:1\nCurrentPlayer K:2';
    const coordIdx = text.indexOf('K:2');
    expect(extractMemberName(text, coordIdx)).toBe('CurrentPlayer');
  });
});

describe('extractEventName', () => {
  it('extracts a clean name from a segment', () => {
    expect(extractEventName('  DragonSlayer  ')).toBe('DragonSlayer');
  });

  it('strips leading noise tokens', () => {
    expect(extractEventName('AB 42 DragonSlayer')).toBe('DragonSlayer');
  });

  it('strips level badge at end (1-2 digits)', () => {
    expect(extractEventName('DragonSlayer 35')).toBe('DragonSlayer');
  });

  it('preserves roman numerals', () => {
    expect(extractEventName('King III')).toBe('King III');
  });

  it('strips ambiguous roman-like tokens as noise in event context', () => {
    // In extractEventName, trailing tokens like "Il" and "IIl" are stripped
    // as noise BEFORE roman numeral fix runs (unlike extractMemberName).
    // This documents actual behavior.
    expect(extractEventName('King Il')).toBe('King');
    expect(extractEventName('King IIl')).toBe('King');
  });

  it('preserves proper roman numerals (all [IVX])', () => {
    expect(extractEventName('King II')).toBe('King II');
    expect(extractEventName('King III')).toBe('King III');
    expect(extractEventName('King IV')).toBe('King IV');
  });

  it('strips trailing noise tokens', () => {
    expect(extractEventName('DragonSlayer AB')).toBe('DragonSlayer');
  });

  it('only uses the first line', () => {
    expect(extractEventName('DragonSlayer\nOtherStuff')).toBe('DragonSlayer');
  });
});
