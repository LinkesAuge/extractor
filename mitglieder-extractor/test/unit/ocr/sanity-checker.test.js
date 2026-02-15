import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMemberSanityChecks } from '../../../src/ocr/sanity-checker.js';

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() };

beforeEach(() => { vi.clearAllMocks(); });

describe('runMemberSanityChecks', () => {
  it('returns empty array for empty input', () => {
    expect(runMemberSanityChecks([], mockLogger)).toEqual([]);
  });

  it('returns members unchanged when all are valid', () => {
    const members = [
      { name: 'Alpha', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'Beta', coords: 'K:98 X:150 Y:300', score: 900000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    expect(result).toHaveLength(2);
    expect(result[0]._warning).toBeUndefined();
    expect(result[1]._warning).toBeUndefined();
  });

  // ─── Invalid Coords ─────────────────────────────────────────────────────
  it('flags entries with invalid coords format', () => {
    const members = [
      { name: 'Good', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'Bad', coords: 'some garbage', score: 900000 },
      { name: 'Empty', coords: '', score: 800000 },
      { name: 'Missing', coords: null, score: 700000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    expect(result[0]._warning).toBeUndefined();
    expect(result[1]._warning).toBe('invalid_coords');
    expect(result[2]._warning).toBe('invalid_coords');
    expect(result[3]._warning).toBe('invalid_coords');
  });

  // ─── K-value Consistency ────────────────────────────────────────────────
  it('flags entries with deviant K-value', () => {
    const members = [
      { name: 'A', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'B', coords: 'K:98 X:150 Y:300', score: 900000 },
      { name: 'C', coords: 'K:98 X:200 Y:400', score: 800000 },
      { name: 'D', coords: 'K:98 X:250 Y:500', score: 700000 },
      { name: 'Outlier', coords: 'K:497 X:300 Y:600', score: 600000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    expect(result[4]._warning).toBe('wrong_kingdom');
    expect(result[4]._warningDetail).toContain('K:497');
    expect(result[4]._warningDetail).toContain('K:98');
  });

  it('does not flag K-value when no clear majority', () => {
    const members = [
      { name: 'A', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'B', coords: 'K:99 X:150 Y:300', score: 900000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    // Neither should be flagged for wrong_kingdom since no 80% majority
    expect(result[0]._warning).toBeUndefined();
    expect(result[1]._warning).toBeUndefined();
  });

  // ─── Duplicate Coords ──────────────────────────────────────────────────
  it('flags the lower-score entry when two share coordinates', () => {
    const members = [
      { name: 'Real', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'Fake', coords: 'K:98 X:100 Y:200', score: 500000 },
      { name: 'Other', coords: 'K:98 X:300 Y:400', score: 800000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    expect(result[0]._warning).toBeUndefined();
    expect(result[1]._warning).toBe('duplicate_coords');
    expect(result[1]._warningDetail).toContain('Real');
  });

  it('shows fallback name when duplicate winner has no name', () => {
    const members = [
      { coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'Fake', coords: 'K:98 X:100 Y:200', score: 500000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    expect(result[1]._warning).toBe('duplicate_coords');
    expect(result[1]._warningDetail).toContain('(unbekannt)');
  });

  // ─── Zero Score ────────────────────────────────────────────────────────
  it('flags entries with score 0', () => {
    const members = [
      { name: 'HasScore', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'NoScore', coords: 'K:98 X:150 Y:300', score: 0 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    expect(result[0]._warning).toBeUndefined();
    expect(result[1]._warning).toBe('score_zero');
  });

  // ─── Score Outlier ─────────────────────────────────────────────────────
  it('flags score outliers relative to neighbors', () => {
    const members = [
      { name: 'A', coords: 'K:98 X:100 Y:200', score: 950000000 },
      { name: 'B', coords: 'K:98 X:150 Y:300', score: 900000000 },
      { name: 'Low', coords: 'K:98 X:200 Y:400', score: 95000000 }, // ~10% of neighbors
      { name: 'C', coords: 'K:98 X:250 Y:500', score: 850000000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger, { scoreOutlierThreshold: 0.2 });
    expect(result[2]._warning).toBe('score_outlier');
  });

  it('does not flag scores within threshold', () => {
    const members = [
      { name: 'A', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'B', coords: 'K:98 X:150 Y:300', score: 800000 }, // 80% of A
      { name: 'C', coords: 'K:98 X:200 Y:400', score: 600000 },
    ];
    const result = runMemberSanityChecks(members, mockLogger, { scoreOutlierThreshold: 0.2 });
    // B is ~80% of A, which is above 20% threshold
    expect(result[1]._warning).toBeUndefined();
  });

  // ─── Priority: first warning wins ─────────────────────────────────────
  it('only sets the first applicable warning per entry', () => {
    const members = [
      { name: 'DoubleBad', coords: 'garbage', score: 0 },
    ];
    const result = runMemberSanityChecks(members, mockLogger);
    // invalid_coords should win over score_zero
    expect(result[0]._warning).toBe('invalid_coords');
  });

  // ─── Logger warnings ──────────────────────────────────────────────────
  it('logs warning count', () => {
    const members = [
      { name: 'Good', coords: 'K:98 X:100 Y:200', score: 1000000 },
      { name: 'Bad', coords: '', score: 0 },
    ];
    runMemberSanityChecks(members, mockLogger);
    const calls = mockLogger.warn.mock.calls.map(c => c[0]);
    expect(calls.some(msg => msg.includes('verdaechtige'))).toBe(true);
  });
});
