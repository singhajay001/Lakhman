import { describe, expect, it } from 'vitest';
import { formatInZone, isWithin, offsetMinutes, zonedTimeToUtc } from './time.js';

// Sydney is UTC+10 in winter and UTC+11 in daylight saving, which begins on the
// first Sunday in October and ends on the first Sunday in April.
describe('Sydney offsets', () => {
  it('is +10 in July', () => {
    expect(offsetMinutes(new Date('2026-07-15T02:00:00Z'))).toBe(600);
  });

  it('is +11 in January', () => {
    expect(offsetMinutes(new Date('2026-01-15T02:00:00Z'))).toBe(660);
  });

  it('changes across the October transition', () => {
    // 2026-10-04 02:00 local is the spring-forward instant (16:00 UTC on the 3rd).
    expect(offsetMinutes(new Date('2026-10-03T15:00:00Z'))).toBe(600);
    expect(offsetMinutes(new Date('2026-10-03T17:00:00Z'))).toBe(660);
  });
});

describe('zonedTimeToUtc', () => {
  it('converts a winter wall-clock time', () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 7, day: 15, hour: 18, minute: 30 });
    expect(utc.toISOString()).toBe('2026-07-15T08:30:00.000Z');
  });

  it('converts a daylight-saving wall-clock time', () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 1, day: 15, hour: 18, minute: 30 });
    expect(utc.toISOString()).toBe('2026-01-15T07:30:00.000Z');
  });

  it('is stable an hour either side of the spring transition', () => {
    // 01:30 local exists at +10; 03:30 local exists at +11. A single-pass
    // conversion gets one of these wrong.
    expect(
      zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 1, minute: 30 }).toISOString(),
    ).toBe('2026-10-03T15:30:00.000Z');
    expect(
      zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 3, minute: 30 }).toISOString(),
    ).toBe('2026-10-03T16:30:00.000Z');
  });

  it('round-trips through the formatter', () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 12, day: 24, hour: 9, minute: 5 });
    expect(
      formatInZone(utc, 'Australia/Sydney', { dateStyle: 'short', timeStyle: 'short' }),
    ).toContain('9:05');
  });

  it('honours a different zone', () => {
    const perth = zonedTimeToUtc(
      { year: 2026, month: 1, day: 15, hour: 18, minute: 30 },
      'Australia/Perth',
    );
    expect(perth.toISOString()).toBe('2026-01-15T10:30:00.000Z');
  });
});

describe('isWithin', () => {
  const window = { start: new Date('2026-05-01T00:00:00Z'), end: new Date('2026-05-01T02:00:00Z') };

  it('includes the start and excludes the end', () => {
    expect(isWithin(window.start, window)).toBe(true);
    expect(isWithin(window.end, window)).toBe(false);
    expect(isWithin(new Date('2026-05-01T01:59:59Z'), window)).toBe(true);
  });
});
