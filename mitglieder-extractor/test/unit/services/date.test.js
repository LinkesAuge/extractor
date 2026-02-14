import { describe, it, expect, vi, afterEach } from 'vitest';
import { localDate, localDateTime } from '../../../src/utils/date.js';

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

describe('localDateTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a string in YYYY-MM-DD_HH-MM-SS format', () => {
    const result = localDateTime();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
  });

  it('formats a specific date correctly', () => {
    vi.useFakeTimers({ now: new Date(2026, 1, 14, 17, 30, 45) }); // Feb 14, 2026 17:30:45
    expect(localDateTime()).toBe('2026-02-14_17-30-45');
  });

  it('pads single-digit hours, minutes, and seconds', () => {
    vi.useFakeTimers({ now: new Date(2026, 0, 5, 3, 7, 9) }); // Jan 5, 2026 03:07:09
    expect(localDateTime()).toBe('2026-01-05_03-07-09');
  });

  it('handles midnight', () => {
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 0, 0, 0) }); // Jun 15, 2026 00:00:00
    expect(localDateTime()).toBe('2026-06-15_00-00-00');
  });

  it('handles end of day', () => {
    vi.useFakeTimers({ now: new Date(2026, 11, 31, 23, 59, 59) }); // Dec 31, 2026 23:59:59
    expect(localDateTime()).toBe('2026-12-31_23-59-59');
  });

  it('accepts a custom date parameter', () => {
    const custom = new Date(2024, 2, 1, 12, 0, 30); // Mar 1, 2024 12:00:30
    expect(localDateTime(custom)).toBe('2024-03-01_12-00-30');
  });
});
