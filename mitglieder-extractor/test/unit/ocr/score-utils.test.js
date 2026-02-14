import { describe, it, expect } from 'vitest';
import { extractScore, findNextBoundary, resolveScoreConflict } from '../../../src/ocr/score-utils.js';

describe('extractScore', () => {
  it('extracts a score above minimum threshold', () => {
    const text = 'Some text 1,234,567 more text';
    expect(extractScore(text, 0, text.length, 10000)).toBe(1234567);
  });

  it('returns 0 when no score meets threshold', () => {
    const text = 'Some text 500 more text';
    expect(extractScore(text, 0, text.length, 10000)).toBe(0);
  });

  it('handles dot-separated scores', () => {
    const text = 'Score: 2.345.678';
    expect(extractScore(text, 0, text.length, 10000)).toBe(2345678);
  });

  it('respects fromIndex and toIndex boundaries', () => {
    const text = '999,999 some text 1,234,567 end';
    // Only search the second half
    const from = text.indexOf('some');
    expect(extractScore(text, from, text.length, 10000)).toBe(1234567);
  });

  it('returns 0 for empty text', () => {
    expect(extractScore('', 0, 0, 10000)).toBe(0);
  });

  it('returns first matching score when multiple exist', () => {
    const text = '1,000,000 then 2,000,000';
    expect(extractScore(text, 0, text.length, 10000)).toBe(1000000);
  });
});

describe('findNextBoundary', () => {
  it('returns text length when no coords or ranks follow', () => {
    expect(findNextBoundary('hello world', 0, [], 0, [])).toBe(11);
  });

  it('returns next coord index as boundary', () => {
    const coords = [{ index: 5 }, { index: 20 }, { index: 40 }];
    expect(findNextBoundary('x'.repeat(50), 6, coords, 0, [])).toBe(20);
  });

  it('returns rank position if closer than next coord', () => {
    const coords = [{ index: 5 }, { index: 40 }];
    const ranks = [{ index: 25 }];
    expect(findNextBoundary('x'.repeat(50), 6, coords, 0, ranks)).toBe(25);
  });

  it('prefers the nearer of coord and rank', () => {
    const coords = [{ index: 5 }, { index: 20 }];
    const ranks = [{ index: 30 }];
    expect(findNextBoundary('x'.repeat(50), 6, coords, 0, ranks)).toBe(20);
  });
});

describe('resolveScoreConflict', () => {
  it('returns non-zero when one is zero', () => {
    expect(resolveScoreConflict(0, 5000000)).toBe(5000000);
    expect(resolveScoreConflict(5000000, 0)).toBe(5000000);
  });

  it('returns the value when both are equal', () => {
    expect(resolveScoreConflict(1234567, 1234567)).toBe(1234567);
  });

  it('handles leading-digit loss (smaller is suffix of larger)', () => {
    // 5,822,073 → 822,073 (smaller is suffix)
    expect(resolveScoreConflict(5822073, 822073)).toBe(5822073);
    expect(resolveScoreConflict(822073, 5822073)).toBe(5822073);
  });

  it('handles first-digit misread (same length, tail matches)', () => {
    // 8,939,291 → 3,939,291
    expect(resolveScoreConflict(8939291, 3939291)).toBe(8939291);
  });

  it('handles comma-to-digit error (5x-15x ratio)', () => {
    // Score reads 10x too large due to comma→digit OCR error
    expect(resolveScoreConflict(50000000, 5000000)).toBe(5000000);
  });

  it('defaults to scoreA when no pattern matches', () => {
    // 1234 vs 5678: different tails, ratio 4.6x (below 5x threshold)
    expect(resolveScoreConflict(1234, 5678)).toBe(1234);
  });

  it('returns scoreA when both are zero', () => {
    expect(resolveScoreConflict(0, 0)).toBe(0);
  });

  it('returns smaller at exact 5x ratio boundary', () => {
    // 55555/11111 = 5.0, tails differ → ratio check kicks in
    expect(resolveScoreConflict(55555, 11111)).toBe(11111);
  });

  it('returns smaller at exact 15x ratio boundary', () => {
    // 166665/11111 = 15.0, tails differ
    expect(resolveScoreConflict(166665, 11111)).toBe(11111);
  });

  it('falls through at 16x ratio (above boundary)', () => {
    // 177776/11111 = 16.0 → not in [5,15] range
    expect(resolveScoreConflict(11111, 177776)).toBe(11111);
  });
});
