import { describe, it, expect } from 'vitest';
import { applyKnownCorrections, levenshtein } from '../../../src/ocr/name-corrector.js';

// ─── levenshtein ─────────────────────────────────────────────────────────────

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('foo', 'foo')).toBe(0);
  });

  it('returns length of other string when one is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('counts single substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('counts insertions and deletions', () => {
    expect(levenshtein('abc', 'abcd')).toBe(1);
    expect(levenshtein('abcd', 'abc')).toBe(1);
  });

  it('handles multi-edit distances', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

// ─── applyKnownCorrections ──────────────────────────────────────────────────

describe('applyKnownCorrections', () => {
  const baseCtx = () => ({
    corrections: { 'Poo Fighter': 'Foo Fighter', 'Schrnerztherapeut': 'Schmerztherapeut' },
    knownNames: ['Foo Fighter', 'Schmerztherapeut', 'Metalla 137', 'Angus', 'KatHi'],
  });

  // ─── Null / empty guard ──────────────────────────────────────────────────

  it('returns unchanged name when context is null', () => {
    const result = applyKnownCorrections('Foo', null);
    expect(result).toEqual({ name: 'Foo', corrected: false, method: null });
  });

  it('returns unchanged name when name is empty', () => {
    const result = applyKnownCorrections('', baseCtx());
    expect(result).toEqual({ name: '', corrected: false, method: null });
  });

  // ─── Direct correction ───────────────────────────────────────────────────

  it('applies direct correction from corrections map', () => {
    const result = applyKnownCorrections('Poo Fighter', baseCtx());
    expect(result.name).toBe('Foo Fighter');
    expect(result.corrected).toBe(true);
    expect(result.method).toBe('correction');
  });

  it('applies case-insensitive correction', () => {
    const result = applyKnownCorrections('poo fighter', baseCtx());
    expect(result.name).toBe('Foo Fighter');
    expect(result.corrected).toBe(true);
    expect(result.method).toBe('correction');
  });

  it('resolves correction target to canonical casing', () => {
    const ctx = {
      corrections: { 'bad': 'foo fighter' },
      knownNames: ['Foo Fighter'],
    };
    const result = applyKnownCorrections('bad', ctx);
    expect(result.name).toBe('Foo Fighter');
  });

  // ─── Canonical name match ────────────────────────────────────────────────

  it('normalizes casing to canonical known name', () => {
    const result = applyKnownCorrections('foo fighter', baseCtx());
    expect(result.name).toBe('Foo Fighter');
    expect(result.corrected).toBe(true);
    expect(result.method).toBe('canonical');
  });

  it('returns unchanged when name already matches canonical', () => {
    const result = applyKnownCorrections('Foo Fighter', baseCtx());
    expect(result.name).toBe('Foo Fighter');
    expect(result.corrected).toBe(false);
    expect(result.method).toBe(null);
  });

  // ─── Fuzzy matching ──────────────────────────────────────────────────────

  it('fuzzy matches close name (1 char diff)', () => {
    const result = applyKnownCorrections('Angis', baseCtx());
    expect(result.name).toBe('Angus');
    expect(result.corrected).toBe(true);
    expect(result.method).toBe('fuzzy');
  });

  it('fuzzy matches close name (2 char diff for long name)', () => {
    const result = applyKnownCorrections('Metalla 13x', baseCtx());
    expect(result.name).toBe('Metalla 137');
    expect(result.corrected).toBe(true);
    expect(result.method).toBe('fuzzy');
  });

  it('does not fuzzy match distant names', () => {
    const result = applyKnownCorrections('CompletelyDifferent', baseCtx());
    expect(result.name).toBe('CompletelyDifferent');
    expect(result.corrected).toBe(false);
    expect(result.method).toBe(null);
  });

  it('fuzzy matches suffix (noise prefix)', () => {
    const result = applyKnownCorrections('AB Angus', baseCtx());
    expect(result.name).toBe('Angus');
    expect(result.corrected).toBe(true);
    expect(result.method).toBe('fuzzy');
  });

  // ─── Short names ─────────────────────────────────────────────────────────

  it('uses stricter threshold for short names', () => {
    // "KatHi" (5 chars) — threshold is 2 for length >= 5
    const result = applyKnownCorrections('KetHi', baseCtx());
    expect(result.name).toBe('KatHi');
    expect(result.corrected).toBe(true);
  });

  it('rejects 2-char diff for very short names (< 5 chars)', () => {
    const ctx = { corrections: {}, knownNames: ['Gh'] };
    // "Xh" has distance 1 from "Gh" — threshold is 1 for len < 5
    const result1 = applyKnownCorrections('Xh', ctx);
    expect(result1.name).toBe('Gh');
    // "Xx" has distance 2 from "Gh" — exceeds threshold
    const result2 = applyKnownCorrections('Xx', ctx);
    expect(result2.corrected).toBe(false);
  });

  // ─── Context caching ─────────────────────────────────────────────────────

  it('builds and reuses _lowerMap cache across calls', () => {
    const ctx = baseCtx();
    expect(ctx._lowerMap).toBeUndefined();
    applyKnownCorrections('Angus', ctx);
    expect(ctx._lowerMap).toBeInstanceOf(Map);
    const cached = ctx._lowerMap;
    applyKnownCorrections('KatHi', ctx);
    expect(ctx._lowerMap).toBe(cached);
  });

  // ─── Priority: corrections > canonical > fuzzy ───────────────────────────

  it('correction takes priority over fuzzy match', () => {
    const ctx = {
      corrections: { 'Poo': 'Pool' },
      knownNames: ['Foo'],
    };
    // "Poo" has a direct correction to "Pool" AND is distance 1 from "Foo".
    // Correction must win.
    const result = applyKnownCorrections('Poo', ctx);
    expect(result.name).toBe('Pool');
    expect(result.method).toBe('correction');
  });
});
