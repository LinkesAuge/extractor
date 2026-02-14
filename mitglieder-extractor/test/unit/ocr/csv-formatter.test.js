import { describe, it, expect } from 'vitest';
import { toMemberCSV, toEventCSV } from '../../../src/ocr/csv-formatter.js';

const BOM = '\uFEFF';

describe('toMemberCSV', () => {
  it('generates a CSV header with BOM', () => {
    const csv = toMemberCSV([]);
    expect(csv).toBe(BOM + 'Name,Koordinaten,Score');
  });

  it('formats member rows correctly', () => {
    const members = [
      { name: 'TestPlayer', coords: 'K:1 X:100 Y:200', score: 5000000 },
      { name: 'Other', coords: 'K:2 X:50 Y:50', score: 1000000 },
    ];
    const csv = toMemberCSV(members);
    const lines = csv.replace(BOM, '').split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Name,Koordinaten,Score');
    expect(lines[1]).toBe('"TestPlayer","K:1 X:100 Y:200",5000000');
    expect(lines[2]).toBe('"Other","K:2 X:50 Y:50",1000000');
  });

  it('escapes double quotes in names', () => {
    const members = [{ name: 'Player "Pro"', coords: 'K:1', score: 100 }];
    const csv = toMemberCSV(members);
    expect(csv).toContain('"Player ""Pro"""');
  });
});

describe('toEventCSV', () => {
  it('generates a CSV header with BOM', () => {
    const csv = toEventCSV([]);
    expect(csv).toBe(BOM + 'Name,Macht,Event-Punkte');
  });

  it('formats event rows correctly', () => {
    const entries = [
      { name: 'Alpha', power: 3000000, eventPoints: 15000 },
      { name: 'Beta', power: 1500000, eventPoints: 8000 },
    ];
    const csv = toEventCSV(entries);
    const lines = csv.replace(BOM, '').split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('"Alpha",3000000,15000');
    expect(lines[2]).toBe('"Beta",1500000,8000');
  });
});
