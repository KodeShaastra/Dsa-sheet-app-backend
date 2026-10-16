import { z } from 'zod';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD", real calendar dates only (rejects 2026-02-30). */
export const dateSchema = z.iso.date();

/** "2026-10-20" → Date at UTC midnight, for @db.Date columns. */
export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Date from a @db.Date column → "2026-10-20". */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The earliest date that is "today" somewhere in the world (UTC-12 is a day behind UTC).
 * The server doesn't know the user's time zone, so "not in the past" means "not before this".
 */
export function earliestToday(now = new Date()): string {
  return toDateString(new Date(now.getTime() - MS_PER_DAY));
}
