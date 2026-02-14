import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectOverlapGaps,
  estimateOptimalScrollDistance,
  computeAverageRowHeight,
  analyzeOverlap,
} from '../../../src/ocr/overlap-detector.js';

/** Silent logger for tests. */
let mockLogger;

beforeEach(() => {
  mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ detectOverlapGaps ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectOverlapGaps', () => {
  it('returns empty results for fewer than 2 files', () => {
    const result = detectOverlapGaps([], ['0001.png'], mockLogger);
    expect(result.gaps).toEqual([]);
    expect(result.overlapCounts).toEqual([]);
  });

  it('returns empty results for empty file list', () => {
    const result = detectOverlapGaps([], [], mockLogger);
    expect(result.gaps).toEqual([]);
    expect(result.overlapCounts).toEqual([]);
  });

  it('detects no gaps when all consecutive pairs share members', () => {
    const files = ['0001.png', '0002.png', '0003.png'];
    const members = [
      { name: 'Alice', coords: 'K:1 X:10 Y:20', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
      { name: 'Bob', coords: 'K:1 X:10 Y:30', _sourceFiles: ['/path/0002.png', '/path/0003.png'] },
      { name: 'Carol', coords: 'K:1 X:10 Y:40', _sourceFiles: ['/path/0001.png'] },
      { name: 'Dave', coords: 'K:1 X:10 Y:50', _sourceFiles: ['/path/0003.png'] },
    ];
    const { gaps, overlapCounts } = detectOverlapGaps(members, files, mockLogger);
    expect(gaps).toEqual([]);
    expect(overlapCounts).toEqual([1, 1]);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('detects a gap between screenshots with no shared members', () => {
    const files = ['0001.png', '0002.png', '0003.png'];
    const members = [
      { name: 'Alice', coords: 'K:1 X:10 Y:20', _sourceFiles: ['/path/0001.png'] },
      { name: 'Bob', coords: 'K:1 X:10 Y:30', _sourceFiles: ['/path/0001.png'] },
      // Gap: no member appears in both 0001 and 0002
      { name: 'Carol', coords: 'K:1 X:10 Y:40', _sourceFiles: ['/path/0002.png', '/path/0003.png'] },
      { name: 'Dave', coords: 'K:1 X:10 Y:50', _sourceFiles: ['/path/0003.png'] },
    ];
    const { gaps, overlapCounts } = detectOverlapGaps(members, files, mockLogger);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({ before: '0001.png', after: '0002.png', index: 0 });
    expect(overlapCounts).toEqual([0, 1]);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('detects multiple gaps', () => {
    const files = ['0001.png', '0002.png', '0003.png', '0004.png'];
    const members = [
      { name: 'Alice', coords: 'K:1', _sourceFiles: ['/path/0001.png'] },
      { name: 'Bob', coords: 'K:2', _sourceFiles: ['/path/0002.png'] },
      { name: 'Carol', coords: 'K:3', _sourceFiles: ['/path/0003.png'] },
      { name: 'Dave', coords: 'K:4', _sourceFiles: ['/path/0004.png'] },
    ];
    const { gaps, overlapCounts } = detectOverlapGaps(members, files, mockLogger);
    expect(gaps).toHaveLength(3);
    expect(overlapCounts).toEqual([0, 0, 0]);
  });

  it('counts multiple shared members per pair', () => {
    const files = ['0001.png', '0002.png'];
    const members = [
      { name: 'Alice', coords: 'K:1', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
      { name: 'Bob', coords: 'K:2', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
      { name: 'Carol', coords: 'K:3', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
    ];
    const { gaps, overlapCounts } = detectOverlapGaps(members, files, mockLogger);
    expect(gaps).toEqual([]);
    expect(overlapCounts).toEqual([3]);
  });

  it('does not flag a gap when one screenshot has no members', () => {
    const files = ['0001.png', '0002.png', '0003.png'];
    const members = [
      { name: 'Alice', coords: 'K:1', _sourceFiles: ['/path/0001.png'] },
      // 0002.png has no members (empty screenshot or error)
      { name: 'Bob', coords: 'K:2', _sourceFiles: ['/path/0003.png'] },
    ];
    const { gaps } = detectOverlapGaps(members, files, mockLogger);
    // 0001→0002: membersA.size=1 but membersB.size=0 → not flagged as gap
    // 0002→0003: membersA.size=0 → not flagged as gap
    expect(gaps).toEqual([]);
  });

  it('uses name as fallback key when coords are missing', () => {
    const files = ['0001.png', '0002.png'];
    const members = [
      { name: 'Alice', coords: '', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
    ];
    const { gaps, overlapCounts } = detectOverlapGaps(members, files, mockLogger);
    expect(gaps).toEqual([]);
    expect(overlapCounts).toEqual([1]);
  });

  it('handles members with no _sourceFiles gracefully', () => {
    const files = ['0001.png', '0002.png'];
    const members = [
      { name: 'Alice', coords: 'K:1' },
      { name: 'Bob', coords: 'K:2', _sourceFiles: [] },
    ];
    const { gaps, overlapCounts } = detectOverlapGaps(members, files, mockLogger);
    // No members assigned to any file → both files have 0 members → no gap flagged
    expect(gaps).toEqual([]);
    expect(overlapCounts).toEqual([0]);
  });

  it('extracts basename correctly from full paths', () => {
    const files = ['0001.png', '0002.png'];
    const members = [
      {
        name: 'Alice',
        coords: 'K:1',
        _sourceFiles: ['D:\\long\\path\\to\\captures\\0001.png', 'D:\\long\\path\\to\\captures\\0002.png'],
      },
    ];
    const { gaps, overlapCounts } = detectOverlapGaps(members, files, mockLogger);
    expect(gaps).toEqual([]);
    expect(overlapCounts).toEqual([1]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ estimateOptimalScrollDistance ════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

describe('estimateOptimalScrollDistance', () => {
  it('returns 0 for zero region height', () => {
    const result = estimateOptimalScrollDistance(0, 80);
    expect(result.recommended).toBe(0);
  });

  it('returns 0 for zero row height', () => {
    const result = estimateOptimalScrollDistance(400, 0);
    expect(result.recommended).toBe(0);
  });

  it('recommends regionHeight minus 2 rows of overlap', () => {
    // region = 400px, row = 80px → overlap = 2*80 = 160px → recommended = 400 - 160 = 240px
    const result = estimateOptimalScrollDistance(400, 80);
    expect(result.recommended).toBe(240);
    expect(result.targetOverlapRows).toBe(2);
    expect(result.overlapPx).toBe(160);
  });

  it('never recommends less than one row height', () => {
    // region = 100px, row = 80px → overlap = 160px → regionHeight - overlap = -60 → clamp to 80
    const result = estimateOptimalScrollDistance(100, 80);
    expect(result.recommended).toBe(80);
  });

  it('handles large region with small rows', () => {
    // region = 1000px, row = 50px → overlap = 100px → recommended = 900px
    const result = estimateOptimalScrollDistance(1000, 50);
    expect(result.recommended).toBe(900);
    expect(result.overlapPx).toBe(100);
  });

  it('handles exact 3-row region', () => {
    // region = 240px, row = 80px → overlap = 160px → recommended = 80px (= 1 row)
    const result = estimateOptimalScrollDistance(240, 80);
    expect(result.recommended).toBe(80);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ computeAverageRowHeight ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeAverageRowHeight', () => {
  it('returns 0 for empty input', () => {
    expect(computeAverageRowHeight([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(computeAverageRowHeight([80])).toBe(80);
  });

  it('computes average of uniform row heights', () => {
    expect(computeAverageRowHeight([80, 80, 80, 80])).toBe(80);
  });

  it('computes average of slightly varying row heights', () => {
    // All within 50% of median (78), so all kept: avg = (76+78+80+82)/4 = 79
    expect(computeAverageRowHeight([76, 78, 80, 82])).toBe(79);
  });

  it('filters out small outliers (partial crops)', () => {
    // Median of [20, 78, 80, 82, 84] is 80. Filter: >= 40, <= 120
    // Keeps [78, 80, 82, 84], discards 20
    expect(computeAverageRowHeight([80, 82, 20, 78, 84])).toBe(81);
  });

  it('filters out large outliers (edge artifacts)', () => {
    // Median of [78, 80, 82, 84, 300] is 82. Filter: >= 41, <= 123
    // Keeps [78, 80, 82, 84], discards 300
    expect(computeAverageRowHeight([80, 82, 300, 78, 84])).toBe(81);
  });

  it('returns median when all values are outliers relative to each other', () => {
    // Sorted: [10, 200]. Median = 200. Filter >= 100, <= 300 → keeps [200]
    // Wait, only [200] passes, so avg = 200
    expect(computeAverageRowHeight([10, 200])).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ analyzeOverlap ══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

describe('analyzeOverlap', () => {
  it('combines gap detection and scroll recommendation', () => {
    const files = ['0001.png', '0002.png', '0003.png'];
    const members = [
      { name: 'Alice', coords: 'K:1', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
      { name: 'Bob', coords: 'K:2', _sourceFiles: ['/path/0002.png', '/path/0003.png'] },
    ];
    const regionHeight = 400;
    const rowHeights = [80, 82, 78, 80];
    const result = analyzeOverlap(members, files, regionHeight, rowHeights, mockLogger);
    expect(result.gaps).toEqual([]);
    expect(result.overlapCounts).toEqual([1, 1]);
    expect(result.avgRowHeight).toBe(80);
    expect(result.scrollRecommendation.recommended).toBe(240);
  });

  it('logs recommendation info', () => {
    const files = ['0001.png', '0002.png'];
    const members = [
      { name: 'Alice', coords: 'K:1', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
    ];
    analyzeOverlap(members, files, 400, [80, 80], mockLogger);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Scroll-Empfehlung')
    );
  });

  it('handles empty row heights gracefully', () => {
    const files = ['0001.png', '0002.png'];
    const members = [
      { name: 'Alice', coords: 'K:1', _sourceFiles: ['/path/0001.png', '/path/0002.png'] },
    ];
    const result = analyzeOverlap(members, files, 400, [], mockLogger);
    expect(result.avgRowHeight).toBe(0);
    expect(result.scrollRecommendation.recommended).toBe(0);
  });

  it('detects gaps and still provides scroll recommendation', () => {
    const files = ['0001.png', '0002.png'];
    const members = [
      { name: 'Alice', coords: 'K:1', _sourceFiles: ['/path/0001.png'] },
      { name: 'Bob', coords: 'K:2', _sourceFiles: ['/path/0002.png'] },
    ];
    const result = analyzeOverlap(members, files, 400, [80, 80], mockLogger);
    expect(result.gaps).toHaveLength(1);
    expect(result.scrollRecommendation.recommended).toBe(240);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lücke')
    );
  });
});
