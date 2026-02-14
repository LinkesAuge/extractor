import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TesseractProvider } from '../../../src/ocr/providers/tesseract-provider.js';
import { toMemberCSV, toEventCSV } from '../../../src/ocr/csv-formatter.js';

const mockLogger = { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('TesseractProvider', () => {
  let processor;

  beforeEach(() => {
    processor = new TesseractProvider(mockLogger, { minScore: 5000 });
    vi.clearAllMocks();
  });

  // ─── Constructor ──────────────────────────────────────────────────────

  describe('constructor', () => {
    it('uses default settings merged with overrides', () => {
      expect(processor.settings.scale).toBe(3);
      expect(processor.settings.minScore).toBe(5000);
    });

    it('creates a default logger when none provided', () => {
      const p = new TesseractProvider(null);
      expect(p.logger).toBeDefined();
      expect(typeof p.logger.info).toBe('function');
    });

    it('starts not aborted', () => {
      expect(processor.aborted).toBe(false);
    });
  });

  describe('abort', () => {
    it('sets aborted flag', () => {
      processor.abort();
      expect(processor.aborted).toBe(true);
    });
  });

  // ─── Member Text Parsing ──────────────────────────────────────────────

  describe('parseOcrText', () => {
    it('parses a single member entry', () => {
      const text = 'Anführer\nDragonSlayer K:98 X:707 Y:919 1,234,567';
      const result = processor.parseOcrText(text);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('DragonSlayer');
      expect(result.entries[0].coords).toBe('K:98 X:707 Y:919');
      expect(result.entries[0].score).toBe(1234567);
      expect(result.entries[0]).not.toHaveProperty('rank');
    });

    it('parses multiple members under same rank section', () => {
      const text = [
        'Anführer',
        'Player1 K:1 X:100 Y:200 5,000,000',
        'Player2 K:2 X:300 Y:400 3,000,000',
      ].join('\n');
      const result = processor.parseOcrText(text);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].name).toBe('Player1');
      expect(result.entries[1].name).toBe('Player2');
    });

    it('parses entries across rank sections', () => {
      const text = [
        'Anführer',
        'Leader K:1 X:100 Y:200 10,000,000',
        'Offizier',
        'Officer1 K:2 X:300 Y:400 5,000,000',
      ].join('\n');
      const result = processor.parseOcrText(text);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].name).toBe('Leader');
      expect(result.entries[1].name).toBe('Officer1');
    });

    it('returns entries without rank or lastRank', () => {
      const text = 'Mitglied\nPlayer K:1 X:1 Y:1 100,000';
      const result = processor.parseOcrText(text);
      expect(result.entries).toHaveLength(1);
      expect(result).not.toHaveProperty('lastRank');
    });

    it('returns empty entries for text without coordinates', () => {
      const result = processor.parseOcrText('Some random text without coords');
      expect(result.entries).toHaveLength(0);
    });

    it('skips entries with very short names', () => {
      const text = 'A K:1 X:1 Y:1 100,000';
      const result = processor.parseOcrText(text);
      // Name "A" is only 1 char, might be stripped/kept based on noise filtering
      // but the parser requires name.length >= 2
      expect(result.entries.every(e => e.name.length >= 2)).toBe(true);
    });

    it('handles OCR coordinate errors (K→1, Y→V)', () => {
      const text = 'Player 1:98 X:707 V:919 1,234,567';
      const result = processor.parseOcrText(text);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].coords).toBe('K:98 X:707 Y:919');
    });
  });

  // ─── Score Map Extraction ─────────────────────────────────────────────

  describe('_extractScoresMap', () => {
    it('maps coordinate strings to scores', () => {
      const text = 'Player1 K:1 X:100 Y:200 5,000,000\nPlayer2 K:2 X:300 Y:400 3,000,000';
      const map = processor._extractScoresMap(text);
      expect(map['K:1 X:100 Y:200']).toBe(5000000);
      expect(map['K:2 X:300 Y:400']).toBe(3000000);
    });

    it('returns empty map for text without coordinates', () => {
      expect(processor._extractScoresMap('no coords here')).toEqual({});
    });
  });

  // ─── Event Text Parsing ───────────────────────────────────────────────

  describe('parseEventText', () => {
    it('parses a single event entry with clan tag', () => {
      // In real OCR, scores appear on lines below the name
      const text = '[K98] DragonSlayer\n15,000 Punkte\n3,000,000';
      const result = processor.parseEventText(text);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('DragonSlayer');
    });

    it('parses multiple event entries', () => {
      const text = [
        '[K98] Player1 10,000 Punkte',
        '5,000,000',
        '[K98] Player2 8,000 Punkte',
        '3,000,000',
      ].join('\n');
      const result = processor.parseEventText(text);
      expect(result.entries).toHaveLength(2);
    });

    it('returns empty entries for text without clan tags', () => {
      const result = processor.parseEventText('No clan tags here 1,000,000');
      expect(result.entries).toHaveLength(0);
    });
  });

  // ─── Event Score Extraction ───────────────────────────────────────────

  describe('_extractEventScores', () => {
    it('handles "0 Punkte" special case', () => {
      const segment = ' DragonSlayer 0 Punkte\n3,000,000';
      const result = processor._extractEventScores(segment, 5000);
      expect(result.eventPoints).toBe(0);
      expect(result.power).toBe(3000000);
    });

    it('returns zeros for segment with no scores', () => {
      const result = processor._extractEventScores(' DragonSlayer', 5000);
      expect(result.power).toBe(0);
      expect(result.eventPoints).toBe(0);
    });

    it('identifies power and eventPoints with Punkte keyword', () => {
      const segment = ' DragonSlayer 15,000 Punkte\n3,000,000';
      const result = processor._extractEventScores(segment, 5000);
      expect(result.eventPoints).toBe(15000);
      expect(result.power).toBe(3000000);
    });
  });

  // ─── CSV Formatting ───────────────────────────────────────────────────

  describe('csv-formatter', () => {
    it('toMemberCSV formats member data', () => {
      const csv = toMemberCSV([{ name: 'Test', coords: 'K:1', score: 100 }]);
      expect(csv).toContain('Name,Koordinaten,Score');
      expect(csv).toContain('Test');
    });

    it('toEventCSV formats event data', () => {
      const csv = toEventCSV([{ name: 'Test', power: 100, eventPoints: 50 }]);
      expect(csv).toContain('Name,Macht,Event-Punkte');
      expect(csv).toContain('Test');
    });
  });
});
