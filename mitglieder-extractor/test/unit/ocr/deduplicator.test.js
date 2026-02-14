import { describe, it, expect, vi } from 'vitest';
import { deduplicateMembersByName, deduplicateEventsByName } from '../../../src/ocr/deduplicator.js';

/** Silent logger for tests. */
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('deduplicateMembersByName', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateMembersByName([], mockLogger)).toEqual([]);
  });

  it('keeps unique members unchanged', () => {
    const members = [
      { name: 'Alpha', rank: '1', coords: 'K:1', score: 100 },
      { name: 'Beta', rank: '2', coords: 'K:2', score: 200 },
    ];
    const result = deduplicateMembersByName(members, mockLogger);
    expect(result).toHaveLength(2);
  });

  it('removes exact name duplicates (case insensitive) and keeps first score', () => {
    const members = [
      { name: 'Alpha', coords: 'K:1', score: 100, _sourceFiles: ['a.png'] },
      { name: 'alpha', coords: 'K:1', score: 500, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateMembersByName(members, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(100);
    expect(result[0]._sourceFiles).toContain('a.png');
    expect(result[0]._sourceFiles).toContain('b.png');
  });

  it('updates score from 0 when duplicate has non-zero score', () => {
    const members = [
      { name: 'Alpha', coords: 'K:1', score: 0, _sourceFiles: ['a.png'] },
      { name: 'alpha', coords: 'K:1', score: 500, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateMembersByName(members, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(500);
  });

  it('removes noise-prefix duplicates keeping shorter name with longer score', () => {
    const members = [
      { name: 'DragonSlayer', coords: 'K:1', score: 900, _sourceFiles: ['a.png'] },
      { name: 'AB DragonSlayer', coords: 'K:1', score: 1000, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateMembersByName(members, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('DragonSlayer');
    // pickBetterScore keeps 1000 (4 digits) over 900 (3 digits)
    expect(result[0].score).toBe(1000);
  });

  it('removes fuzzy name duplicates (OCR near-misses)', () => {
    const members = [
      { name: 'Foo Fighter', coords: 'K:98 X:672 Y:848', score: 1102584591, _sourceFiles: ['a.png'] },
      { name: 'Poo Fighter', coords: 'K:98 X:072 Y:848', score: 1102584591, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateMembersByName(members, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Foo Fighter');
  });

  it('removes adjacent score duplicates keeping longer name', () => {
    const members = [
      { name: 'AB', rank: '1', coords: 'K:1', score: 5000, _sourceFiles: ['a.png'] },
      { name: 'Alpha Beta', rank: '2', coords: 'K:1', score: 5000, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateMembersByName(members, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Beta');
  });

  it('removes non-adjacent score+K duplicates', () => {
    const members = [
      { name: 'Alpha', rank: '1', coords: 'K:5 X:10 Y:20', score: 5000, _sourceFiles: [] },
      { name: 'Beta', rank: '2', coords: 'K:3 X:11 Y:21', score: 3000, _sourceFiles: [] },
      { name: 'AlphaLong', rank: '3', coords: 'K:5 X:10 Y:20', score: 5000, _sourceFiles: [] },
    ];
    const result = deduplicateMembersByName(members, mockLogger);
    expect(result).toHaveLength(2);
    const names = result.map(m => m.name);
    expect(names).toContain('AlphaLong');
    expect(names).toContain('Beta');
  });
});

describe('deduplicateEventsByName', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateEventsByName([], mockLogger)).toEqual([]);
  });

  it('keeps unique events unchanged', () => {
    const events = [
      { name: 'Alpha', power: 100, eventPoints: 50 },
      { name: 'Beta', power: 200, eventPoints: 80 },
    ];
    const result = deduplicateEventsByName(events, mockLogger);
    expect(result).toHaveLength(2);
  });

  it('removes exact duplicates keeping first non-zero power and eventPoints', () => {
    const events = [
      { name: 'Alpha', power: 100, eventPoints: 50, _sourceFiles: ['a.png'] },
      { name: 'alpha', power: 300, eventPoints: 20, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateEventsByName(events, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].power).toBe(100);
    expect(result[0].eventPoints).toBe(50);
  });

  it('updates power from 0 when duplicate has non-zero power', () => {
    const events = [
      { name: 'Alpha', power: 0, eventPoints: 50, _sourceFiles: ['a.png'] },
      { name: 'alpha', power: 300, eventPoints: 20, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateEventsByName(events, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].power).toBe(300);
    expect(result[0].eventPoints).toBe(50);
  });

  it('keeps lower score when duplicate has lower score', () => {
    const events = [
      { name: 'Alpha', power: 500, eventPoints: 100, _sourceFiles: ['a.png'] },
      { name: 'alpha', power: 200, eventPoints: 50, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateEventsByName(events, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].power).toBe(500);
    expect(result[0].eventPoints).toBe(100);
  });

  it('removes adjacent score duplicates keeping longer name', () => {
    const events = [
      { name: 'AB', power: 5000, eventPoints: 100, _sourceFiles: ['a.png'] },
      { name: 'Alpha Beta', power: 5000, eventPoints: 100, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateEventsByName(events, mockLogger);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Beta');
  });

  it('does NOT merge when power matches but eventPoints differ', () => {
    const events = [
      { name: 'Alpha', power: 5000, eventPoints: 100, _sourceFiles: ['a.png'] },
      { name: 'Beta', power: 5000, eventPoints: 200, _sourceFiles: ['b.png'] },
    ];
    const result = deduplicateEventsByName(events, mockLogger);
    expect(result).toHaveLength(2);
  });
});
