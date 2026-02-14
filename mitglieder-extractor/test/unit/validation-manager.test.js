import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationManager } from '../../src/validation-manager.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/** Create a ValidationManager backed by a temp directory. */
function createTestManager() {
  const dir = join(tmpdir(), `vm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return { manager: new ValidationManager(dir), dir };
}

describe('ValidationManager', () => {
  let manager;
  let dir;

  beforeEach(() => {
    ({ manager, dir } = createTestManager());
  });

  // ─── Name Management ───────────────────────────────────────────────────

  describe('addName', () => {
    it('adds a new name and returns true', () => {
      expect(manager.addName('Player1')).toBe(true);
      expect(manager.knownNames).toContain('Player1');
    });

    it('trims whitespace', () => {
      manager.addName('  Player1  ');
      expect(manager.knownNames).toContain('Player1');
    });

    it('returns false for empty string', () => {
      expect(manager.addName('')).toBe(false);
      expect(manager.addName('   ')).toBe(false);
    });

    it('returns false for duplicate names', () => {
      manager.addName('Player1');
      expect(manager.addName('Player1')).toBe(false);
    });
  });

  describe('removeName', () => {
    it('removes an existing name and returns true', () => {
      manager.addName('Player1');
      expect(manager.removeName('Player1')).toBe(true);
      expect(manager.knownNames).not.toContain('Player1');
    });

    it('returns false for non-existing name', () => {
      expect(manager.removeName('NoSuch')).toBe(false);
    });

    it('removes associated corrections pointing to that name', () => {
      manager.addName('Player1');
      manager.addCorrection('Playr1', 'Player1');
      manager.removeName('Player1');
      expect(manager.corrections).not.toHaveProperty('Playr1');
    });
  });

  // ─── Corrections ──────────────────────────────────────────────────────

  describe('addCorrection', () => {
    it('maps OCR name to correct name', () => {
      manager.addCorrection('P1ayer', 'Player');
      expect(manager.corrections['P1ayer']).toBe('Player');
    });

    it('also adds the correct name to knownNames', () => {
      manager.addCorrection('P1ayer', 'Player');
      expect(manager.knownNames).toContain('Player');
    });
  });

  describe('removeCorrection', () => {
    it('removes a correction mapping', () => {
      manager.addCorrection('P1ayer', 'Player');
      manager.removeCorrection('P1ayer');
      expect(manager.corrections).not.toHaveProperty('P1ayer');
    });
  });

  // ─── Import / Export ──────────────────────────────────────────────────

  describe('importNames', () => {
    it('imports multiple names and returns count of new additions', () => {
      manager.addName('Existing');
      const count = manager.importNames(['Existing', 'New1', 'New2']);
      expect(count).toBe(2);
      expect(manager.knownNames).toHaveLength(3);
    });
  });

  describe('exportData', () => {
    it('returns sorted names and corrections copy', () => {
      manager.addName('Zeta');
      manager.addName('Alpha');
      manager.addCorrection('Alph', 'Alpha');
      const data = manager.exportData();
      expect(data.knownNames[0]).toBe('Alpha');
      expect(data.knownNames[1]).toBe('Zeta');
      expect(data.corrections['Alph']).toBe('Alpha');
    });
  });

  // ─── Persistence ──────────────────────────────────────────────────────

  describe('save and load', () => {
    it('persists and restores data', async () => {
      await mkdir(dir, { recursive: true });
      manager.addName('TestPlayer');
      manager.addCorrection('TstPlayer', 'TestPlayer');
      await manager.save();
      const manager2 = new ValidationManager(dir);
      const state = await manager2.load();
      expect(state.knownNames).toContain('TestPlayer');
      expect(state.corrections['TstPlayer']).toBe('TestPlayer');
    });

    it('handles missing file gracefully', async () => {
      const state = await manager.load();
      expect(state.knownNames).toEqual([]);
      expect(state.corrections).toEqual({});
    });
  });

  // ─── Clan Tag Stripping ───────────────────────────────────────────────

  describe('stripClanTag', () => {
    it('removes [K98] format', () => {
      expect(ValidationManager.stripClanTag('[K98] DragonSlayer')).toBe('DragonSlayer');
    });

    it('removes (K99) format', () => {
      expect(ValidationManager.stripClanTag('(K99) SomePlayer')).toBe('SomePlayer');
    });

    it('handles OCR misreads of K', () => {
      expect(ValidationManager.stripClanTag('[1:98] PlayerName')).toBe('PlayerName');
    });

    it('returns name unchanged when no clan tag', () => {
      expect(ValidationManager.stripClanTag('JustAName')).toBe('JustAName');
    });

    it('removes {K98} format', () => {
      expect(ValidationManager.stripClanTag('{K98} SomePlayer')).toBe('SomePlayer');
    });

    it('removes <K98> format', () => {
      expect(ValidationManager.stripClanTag('<K98> SomePlayer')).toBe('SomePlayer');
    });
  });

  // ─── Validation Pipeline ──────────────────────────────────────────────

  describe('validateMembers', () => {
    beforeEach(() => {
      manager.addName('DragonSlayer');
      manager.addName('KingArthur');
      manager.addCorrection('DragnSlayer', 'DragonSlayer');
    });

    it('confirms exact match (case insensitive)', () => {
      const result = manager.validateMembers([{ name: 'dragonslayer' }]);
      expect(result[0].validationStatus).toBe('confirmed');
      expect(result[0].name).toBe('DragonSlayer');
    });

    it('applies known corrections', () => {
      const result = manager.validateMembers([{ name: 'DragnSlayer' }]);
      expect(result[0].validationStatus).toBe('corrected');
      expect(result[0].name).toBe('DragonSlayer');
    });

    it('suggests fuzzy matches for unknown names', () => {
      const result = manager.validateMembers([{ name: 'DrgonSlayer' }]);
      expect(result[0].validationStatus).toBe('suggested');
      expect(result[0].suggestion).toBe('DragonSlayer');
    });

    it('marks truly unknown names', () => {
      const result = manager.validateMembers([{ name: 'CompletelyNewPlayer' }]);
      expect(result[0].validationStatus).toBe('unknown');
      expect(result[0].suggestion).toBeNull();
    });

    it('preserves original name in originalName', () => {
      const result = manager.validateMembers([{ name: 'DragnSlayer', score: 100 }]);
      expect(result[0].originalName).toBe('DragnSlayer');
      expect(result[0].score).toBe(100);
    });

    it('strips clan tag in event mode before validation', () => {
      const result = manager.validateMembers(
        [{ name: '[K98] DragonSlayer' }],
        { mode: 'event' },
      );
      expect(result[0].validationStatus).toBe('confirmed');
      expect(result[0].name).toBe('DragonSlayer');
    });
  });

  // ─── Levenshtein Distance ─────────────────────────────────────────────

  describe('_levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(manager._levenshtein('abc', 'abc')).toBe(0);
    });

    it('returns string length when comparing to empty', () => {
      expect(manager._levenshtein('abc', '')).toBe(3);
      expect(manager._levenshtein('', 'abc')).toBe(3);
    });

    it('computes single substitution', () => {
      expect(manager._levenshtein('abc', 'adc')).toBe(1);
    });

    it('computes single insertion', () => {
      expect(manager._levenshtein('abc', 'abdc')).toBe(1);
    });

    it('computes single deletion', () => {
      expect(manager._levenshtein('abdc', 'abc')).toBe(1);
    });

    it('computes larger distance', () => {
      expect(manager._levenshtein('kitten', 'sitting')).toBe(3);
    });
  });

  // ─── Fuzzy Matching ───────────────────────────────────────────────────

  describe('_fuzzyMatch', () => {
    beforeEach(() => {
      manager.addName('DragonSlayer');
      manager.addName('KingArthur');
    });

    it('returns null when no match found', () => {
      expect(manager._fuzzyMatch('XyzAbc123')).toBeNull();
    });

    it('matches exact (case insensitive)', () => {
      expect(manager._fuzzyMatch('dragonslayer')).toBe('DragonSlayer');
    });

    it('matches suffix patterns (noise prefix)', () => {
      expect(manager._fuzzyMatch('AB DragonSlayer')).toBe('DragonSlayer');
    });

    it('matches within Levenshtein threshold', () => {
      expect(manager._fuzzyMatch('DrgonSlayer')).toBe('DragonSlayer');
    });

    it('matches when known name ends with input (reverse suffix)', () => {
      // knownLower.endsWith(nameLower): "dragonslayer" ends with "slayer"
      expect(manager._fuzzyMatch('Slayer')).toBe('DragonSlayer');
    });

    it('uses threshold 1 for short names (<5 chars)', () => {
      manager.addName('King');
      expect(manager._fuzzyMatch('Kin')).toBe('King'); // distance 1
      expect(manager._fuzzyMatch('Ki')).toBeNull();    // distance 2
    });

    it('uses threshold 2 for longer names (>=5 chars)', () => {
      expect(manager._fuzzyMatch('DrgonSlyer')).toBe('DragonSlayer'); // distance 2
    });
  });
});
