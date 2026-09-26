/**
 * Timestamps are stored UTC and displayed in the shop's timezone (section 2).
 * Sydney observes DST, so "the same time tomorrow" is not always 24 hours later,
 * and a scheduler that assumes it will publish an hour out twice a year.
 */
export const DEFAULT_TIMEZONE = 'Australia/Sydney';

/** Formats an instant in the shop's timezone. Never used for storage. */
export function formatInZone(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(instant);
}

/** The UTC offset in minutes that `timeZone` was on at `instant`. */
export function offsetMinutes(instant: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Intl did not return a ${type} part for ${timeZone}`);
    return Number(part.value);
  };

  // Hour 24 appears at midnight in some ICU versions.
  const hour = read('hour') % 24;
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Converts a wall-clock time in `timeZone` to the UTC instant it denotes.
 *
 * Two-pass, because the offset depends on the instant we are trying to find. A
 * single pass is wrong for the hour either side of a DST transition, which in
 * Sydney is the first Sunday in April and October.
 */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000);
  const corrected = new Date(naive - offsetMinutes(firstGuess, timeZone) * 60_000);
  return corrected;
}

/** Inclusive-start, exclusive-end publication window. */
export interface Window {
  start: Date;
  end: Date;
}

export function isWithin(instant: Date, window: Window): boolean {
  return instant.getTime() >= window.start.getTime() && instant.getTime() < window.end.getTime();
}
