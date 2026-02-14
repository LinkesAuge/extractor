import { describe, it, expect, vi, afterEach } from 'vitest';
import { localDate } from '../../../src/utils/date.js';

describe('localDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a date in YYYY-MM-DD format', () => {
    const result = localDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pads single-digit month and day', () => {
    vi.useFakeTimers({ now: new Date(2026, 0, 5) }); // Jan 5, 2026
    expect(localDate()).toBe('2026-01-05');
  });

  it('handles December correctly', () => {
    vi.useFakeTimers({ now: new Date(2026, 11, 25) }); // Dec 25, 2026
    expect(localDate()).toBe('2026-12-25');
  });

  it('handles leap year', () => {
    vi.useFakeTimers({ now: new Date(2024, 1, 29) }); // Feb 29, 2024
    expect(localDate()).toBe('2024-02-29');
  });

  it('handles year boundary', () => {
    vi.useFakeTimers({ now: new Date(2025, 11, 31) }); // Dec 31, 2025
    expect(localDate()).toBe('2025-12-31');
  });
});
