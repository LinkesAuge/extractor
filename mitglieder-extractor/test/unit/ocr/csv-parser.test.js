import { describe, it, expect } from 'vitest';
import { parseMemberCSV, parseNamesCsv, parseCorrectionsCsv } from '../../../src/ocr/csv-parser.js';

const BOM = '\uFEFF';

describe('parseMemberCSV', () => {
  it('parses a standard member CSV with BOM', () => {
    const csv = `${BOM}Name,Koordinaten,Score\r\n"TestPlayer","K:98 X:123 Y:456",5000000\r\n"Other","K:98 X:789 Y:101",1000000`;
    const members = parseMemberCSV(csv);
    expect(members).toHaveLength(2);
    expect(members[0]).toEqual({ name: 'TestPlayer', coords: 'K:98 X:123 Y:456', score: 5000000 });
    expect(members[1]).toEqual({ name: 'Other', coords: 'K:98 X:789 Y:101', score: 1000000 });
  });

  it('parses CSV without BOM', () => {
    const csv = 'Name,Koordinaten,Score\r\n"Player1","K:1 X:2 Y:3",999';
    const members = parseMemberCSV(csv);
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe('Player1');
    expect(members[0].score).toBe(999);
  });

  it('handles scores with locale formatting (dots and commas)', () => {
    const csv = 'Name,Koordinaten,Score\r\n"Player","K:1 X:1 Y:1","5.000.000"';
    const members = parseMemberCSV(csv);
    expect(members[0].score).toBe(5000000);
  });

  it('handles escaped quotes in names', () => {
    const csv = 'Name,Koordinaten,Score\r\n"Player ""Pro""","K:1 X:1 Y:1",100';
    const members = parseMemberCSV(csv);
    expect(members[0].name).toBe('Player "Pro"');
  });

  it('returns empty array for header-only CSV', () => {
    const csv = 'Name,Koordinaten,Score';
    const members = parseMemberCSV(csv);
    expect(members).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(parseMemberCSV('')).toHaveLength(0);
  });

  it('throws if Name column is missing', () => {
    const csv = 'Koordinaten,Score\r\n"K:1",100';
    expect(() => parseMemberCSV(csv)).toThrow('Name');
  });

  it('skips rows with empty names', () => {
    const csv = 'Name,Koordinaten,Score\r\n"","K:1",100\r\n"Player","K:2",200';
    const members = parseMemberCSV(csv);
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe('Player');
  });

  it('handles LF line endings', () => {
    const csv = 'Name,Koordinaten,Score\n"Player","K:1 X:1 Y:1",999';
    const members = parseMemberCSV(csv);
    expect(members).toHaveLength(1);
  });

  it('accepts alternative header names (coords, coordinates)', () => {
    const csv = 'Name,Coords,Score\r\n"Player","K:1 X:1 Y:1",100';
    const members = parseMemberCSV(csv);
    expect(members[0].coords).toBe('K:1 X:1 Y:1');
  });

  it('defaults coords/score when columns missing', () => {
    const csv = 'Name\r\n"PlayerOnly"';
    const members = parseMemberCSV(csv);
    expect(members[0]).toEqual({ name: 'PlayerOnly', coords: '', score: 0 });
  });
});

describe('parseNamesCsv', () => {
  it('parses a single-column names CSV', () => {
    const csv = `${BOM}Name\r\n"Alpha"\r\n"Beta"\r\n"Gamma"`;
    const names = parseNamesCsv(csv);
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('returns empty for header-only', () => {
    expect(parseNamesCsv('Name')).toHaveLength(0);
  });

  it('skips empty names', () => {
    const csv = 'Name\r\n"Player"\r\n""\r\n"Other"';
    expect(parseNamesCsv(csv)).toEqual(['Player', 'Other']);
  });

  it('throws if Name column missing', () => {
    expect(() => parseNamesCsv('Foo\r\nBar')).toThrow('Name');
  });
});

describe('parseCorrectionsCsv', () => {
  it('parses corrections CSV', () => {
    const csv = `${BOM}OCR-Name,Korrekter Name\r\n"P1ayer","Player"\r\n"Tset","Test"`;
    const pairs = parseCorrectionsCsv(csv);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ ocrName: 'P1ayer', correctName: 'Player' });
    expect(pairs[1]).toEqual({ ocrName: 'Tset', correctName: 'Test' });
  });

  it('returns empty for header-only', () => {
    expect(parseCorrectionsCsv('OCR-Name,Korrekter Name')).toHaveLength(0);
  });

  it('skips rows where either column is empty', () => {
    const csv = 'OCR-Name,Korrekter Name\r\n"P1ayer",""\r\n"","Test"\r\n"Foo","Bar"';
    const pairs = parseCorrectionsCsv(csv);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ ocrName: 'Foo', correctName: 'Bar' });
  });

  it('throws if required columns missing', () => {
    expect(() => parseCorrectionsCsv('Name,Value\r\nA,B')).toThrow();
  });

  it('accepts English header names', () => {
    const csv = 'OCR Name,Correct Name\r\n"A","B"';
    const pairs = parseCorrectionsCsv(csv);
    expect(pairs).toHaveLength(1);
  });
});
